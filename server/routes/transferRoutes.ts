import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { installationService } from '../services/installationService';
import { createRateLimiter } from '../middleware/rateLimit';
import { db } from '../db/client';
import crypto from 'crypto';

const router = Router();

// Rate limiters for transfer claim: 5 attempts per minute and 20 attempts per hour
const claimPerMinuteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'تجاوزت الحد المسموح به من المحاولات (5 محاولات في الدقيقة).',
});

const claimPerHourLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'تجاوزت الحد المسموح به من المحاولات (20 محاولة في الساعة).',
});

function generateTransferCode(): string {
  // 8 digits
  return crypto.randomInt(10000000, 99999999).toString();
}

/**
 * POST /api/sync/transfer/generate
 * Generates a temporary, time-limited (15 mins), revocable transfer code for the current anonymous user.
 * Deletes any previous or expired codes for this user to guarantee only 1 active code per user.
 */
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonymous_user_id = req.user!.anonymous_user_id || req.user!.id;
    if (!anonymous_user_id) {
      res.status(400).json({ error: 'ValidationError', message: 'معرف المستخدم غير صالح.' });
      return;
    }

    // Delete any previous or expired transfer codes for this user (one active code per user)
    await db.execute({
      sql: 'DELETE FROM transfer_codes WHERE anonymous_user_id = ? OR expires_at < datetime("now")',
      args: [anonymous_user_id],
    });

    const code = generateTransferCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresInMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    await db.execute({
      sql: 'INSERT INTO transfer_codes (code_hash, anonymous_user_id, expires_at) VALUES (?, ?, ?)',
      args: [codeHash, anonymous_user_id, expiresAt],
    });

    res.json({
      success: true,
      code,
      expiresInMinutes,
    });
  } catch (err) {
    console.error('Transfer generate API Error:', err);
    res.status(500).json({ error: 'TransferError', message: 'فشل إنشاء كود النقل.' });
  }
});

/**
 * POST /api/sync/transfer/claim
 * Claims a transfer code atomically and generates a secure installation token for the new device.
 * Enforces rate limiting (5/min, 20/hr) and single-use atomic consumption.
 */
router.post('/claim', claimPerMinuteLimiter, claimPerHourLimiter, async (req: Request, res: Response) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      res.status(400).json({ error: 'ValidationError', message: 'يجب إدخال كود النقل.' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const nowIso = new Date().toISOString();

    // Atomic consumption: DELETE and RETURN anonymous_user_id in a single write statement
    const result = await db.execute({
      sql: 'DELETE FROM transfer_codes WHERE code_hash = ? AND expires_at >= ? RETURNING anonymous_user_id',
      args: [codeHash, nowIso],
    });

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'TransferError', message: 'كود النقل غير صحيح أو انتهت صلاحيته أو تم استخدامه بالفعل.' });
      return;
    }

    const sourceUserId = String(result.rows[0].anonymous_user_id);

    // Log the successful transfer event WITHOUT logging the secret code
    console.log(`[Transfer] Successfully claimed transfer code atomically for anonymous user: ${sourceUserId}`);

    // Generate a secure server-issued installation token for the new device
    const token = await installationService.createInstallation(sourceUserId);

    res.json({
      success: true,
      anonymous_user_id: sourceUserId,
      installationCredential: token,
    });
  } catch (err) {
    console.error('Transfer claim API Error:', err);
    res.status(500).json({ error: 'TransferError', message: 'فشل استعادة البيانات عبر الكود.' });
  }
});

export default router;
