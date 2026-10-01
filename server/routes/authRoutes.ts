import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { userService } from '../services/userService';
import { installationService } from '../services/installationService';
import { createRateLimiter } from '../middleware/rateLimit';
import { queryOne, db } from '../db/client';
import { isValidId } from '../utils/validation';
import crypto from 'crypto';

const router = Router();

// Rate limiter for registration: 10 requests per hour per IP
const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'تجاوزت الحد المسموح به لتسجيل أجهزة جديدة (10 طلبات في الساعة).',
});

// POST /api/auth/register
router.post('/register', registerRateLimiter, async (req, res: Response) => {
  try {
    const { anonymousUserId } = req.body || {};
    let targetUserId: string;

    if (anonymousUserId && typeof anonymousUserId === 'string' && isValidId(anonymousUserId)) {
      const existingUser = await userService.getUserById(anonymousUserId);
      if (existingUser) {
        // User already exists on server. Check if client has a valid token for it.
        const authHeader = req.headers.authorization;
        let token: string | undefined;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split('Bearer ')[1].trim();
        }
        if (token) {
          const verified = await installationService.verifyInstallation(token);
          if (verified === anonymousUserId) {
            res.json({
              success: true,
              anonymousUserId,
              installationCredential: token,
              needsInitialUpload: false,
            });
            return;
          }
        }
        // Deny taking over an existing user ID without valid credential! Issue fresh ID.
        targetUserId = 'anon_' + crypto.randomBytes(16).toString('hex');
      } else {
        // Safe: user ID does not exist on server yet (new client instance)
        targetUserId = anonymousUserId;
      }
    } else {
      targetUserId = 'anon_' + crypto.randomBytes(16).toString('hex');
    }

    await userService.getOrCreateAnonymousUser(targetUserId);
    const token = await installationService.createInstallation(targetUserId);

    res.json({
      success: true,
      anonymousUserId: targetUserId,
      installationCredential: token,
      needsInitialUpload: true,
    });
  } catch (err) {
    console.error('Registration API Error:', err);
    res.status(500).json({ error: 'RegistrationError', message: 'فشل تسجيل هوية الجهاز.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const preferences = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    res.json({
      user: req.user,
      preferences: preferences || {},
    });
  } catch (err) {
    console.error('Failed to fetch user session:', err);
    res.status(500).json({ error: 'SessionError', message: 'فشل تحميل بيانات الحساب.' });
  }
});

// PATCH /api/auth/me - update current user
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const { userUpdates, displayName, timezone, locale, photoUrl, preferenceUpdates } = req.body;
    
    let updatedUser = req.user!;
    const profilePayload = userUpdates || { displayName, timezone, locale, photoUrl };
    if (profilePayload.displayName || profilePayload.timezone || profilePayload.locale || profilePayload.photoUrl) {
      const resUser = await userService.updateUser(anonUserId, profilePayload);
      if (resUser) updatedUser = resUser;
    }

    if (preferenceUpdates || timezone || locale) {
      const now = new Date().toISOString();
      const tz = timezone || preferenceUpdates?.timezone || 'Africa/Cairo';
      const loc = locale || preferenceUpdates?.locale || 'ar';
      await db.execute({
        sql: `INSERT INTO user_preferences (anonymous_user_id, timezone, locale, week_start_day, updated_at)
              VALUES (?, ?, ?, 'saturday', ?)
              ON CONFLICT(anonymous_user_id) DO UPDATE SET timezone = excluded.timezone, locale = excluded.locale, updated_at = excluded.updated_at`,
        args: [anonUserId, tz, loc, now],
      });
    }

    const preferences = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    res.json({
      user: updatedUser,
      preferences: preferences || {},
    });
  } catch (err) {
    console.error('Failed to update user session:', err);
    res.status(500).json({ error: 'UpdateError', message: 'فشل تحديث بيانات الحساب.' });
  }
});

// PUT /api/auth/me (alias)
router.put('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const { userUpdates, displayName, timezone, locale, photoUrl } = req.body;
    
    let updatedUser = req.user!;
    const profilePayload = userUpdates || { displayName, timezone, locale, photoUrl };
    if (profilePayload.displayName || profilePayload.timezone || profilePayload.locale || profilePayload.photoUrl) {
      const resUser = await userService.updateUser(anonUserId, profilePayload);
      if (resUser) updatedUser = resUser;
    }

    const preferences = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    res.json({
      user: updatedUser,
      preferences: preferences || {},
    });
  } catch (err) {
    console.error('Failed to update user session:', err);
    res.status(500).json({ error: 'UpdateError', message: 'فشل تحديث بيانات الحساب.' });
  }
});

export default router;
