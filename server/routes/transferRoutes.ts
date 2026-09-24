import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { installationService } from '../services/installationService';
import { db } from '../db/client';
import crypto from 'crypto';

const router = Router();

// Simple in-memory rate limiter for demo purpose
const rateLimit = new Map<string, { count: number; windowStart: number }>();

function generateTransferCode(): string {
  // 8 digits
  return crypto.randomInt(10000000, 99999999).toString();
}

/**
 * POST /api/sync/transfer/generate
 * Generates a temporary, time-limited (15 mins), revocable transfer code for the current anonymous user.
 */
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonymous_user_id = req.user!.anonymous_user_id || req.user!.id;
    if (!anonymous_user_id) {
      res.status(400).json({ error: 'ValidationError', message: 'معرف المستخدم غير صالح.' });
      return;
    }

    const code = generateTransferCode();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresInMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    await db.execute({
        sql: 'INSERT INTO transfer_codes (code_hash, anonymous_user_id, expires_at) VALUES (?, ?, ?)',
        args: [codeHash, anonymous_user_id, expiresAt]
    });

    res.json({
      success: true,
      code,
      expiresInMinutes,
    });
  } catch (err) {
    res.status(500).json({ error: 'TransferError', message: 'فشل إنشاء كود النقل.' });
  }
});

/**
 * POST /api/sync/transfer/claim
 * Claims a transfer code and returns the source anonymous user ID.
 */
router.post('/claim', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const limit = rateLimit.get(ip) || { count: 0, windowStart: now };

    if (now - limit.windowStart > 60000) {
        limit.count = 0;
        limit.windowStart = now;
    }

    if (limit.count >= 5) {
        res.status(429).json({ error: 'TooManyRequests', message: 'حد أقصى للمحاولات.' });
        return;
    }
    limit.count++;
    rateLimit.set(ip, limit);

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'ValidationError', message: 'يجب إدخال كود النقل.' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    
    const result = await db.execute({
        sql: 'SELECT anonymous_user_id, expires_at FROM transfer_codes WHERE code_hash = ?',
        args: [codeHash]
    });

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NotFoundError', message: 'كود النقل غير صحيح.' });
      return;
    }

    const entry = result.rows[0];
    if (new Date(entry.expires_at as string).getTime() < Date.now()) {
      await db.execute({ sql: 'DELETE FROM transfer_codes WHERE code_hash = ?', args: [codeHash] });
      res.status(400).json({ error: 'ExpiredError', message: 'انتهت صلاحية كود النقل.' });
      return;
    }

    // Revoke code immediately upon claim (single use)
    await db.execute({ sql: 'DELETE FROM transfer_codes WHERE code_hash = ?', args: [codeHash] });

    // Generate a secure server-issued installation token for the new device
    const token = await installationService.createInstallation(entry.anonymous_user_id as string);

    res.json({
      success: true,
      anonymous_user_id: entry.anonymous_user_id,
      installationCredential: token,
    });
  } catch (err) {
    res.status(500).json({ error: 'TransferError', message: 'فشل استعادة البيانات عبر الكود.' });
  }
});

export default router;
