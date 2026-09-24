import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { userService } from '../services/userService';
import { installationService } from '../services/installationService';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/register
// Public endpoint to register a new anonymous device installation.
router.post('/register', async (req, res: Response) => {
  try {
    // Generate a new secure unique planner ID, always ignore existing anonymousUserId in request
    const targetUserId = 'anon_' + crypto.randomBytes(16).toString('hex');
    await userService.getOrCreateAnonymousUser(targetUserId);

    // Create a secure server-issued installation token
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
    res.json({
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user session', details: err });
  }
});

// PATCH /api/auth/me - update current user
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userUpdates, displayName, timezone, locale, photoUrl } = req.body;
    
    // Update user profile fields if provided
    let updatedUser = req.user!;
    const profilePayload = userUpdates || { displayName, timezone, locale, photoUrl };
    if (profilePayload.displayName || profilePayload.timezone || profilePayload.locale || profilePayload.photoUrl) {
      const resUser = await userService.updateUser(req.user!.id, profilePayload);
      if (resUser) updatedUser = resUser;
    }

    res.json({
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user session', details: err });
  }
});

// PUT /api/auth/me (alias)
router.put('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userUpdates, displayName, timezone, locale, photoUrl } = req.body;
    
    let updatedUser = req.user!;
    const profilePayload = userUpdates || { displayName, timezone, locale, photoUrl };
    if (profilePayload.displayName || profilePayload.timezone || profilePayload.locale || profilePayload.photoUrl) {
      const resUser = await userService.updateUser(req.user!.id, profilePayload);
      if (resUser) updatedUser = resUser;
    }

    res.json({
      user: updatedUser,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user session', details: err });
  }
});

export default router;
