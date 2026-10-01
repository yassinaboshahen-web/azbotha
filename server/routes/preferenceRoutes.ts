import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryOne } from '../db/client';
import { sendError } from '../utils/validation';

const router = Router();

// GET /api/preferences
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;

    let prefs = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    if (!prefs) {
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO user_preferences (anonymous_user_id, timezone, locale, week_start_day, created_at, updated_at)
              VALUES (?, 'Africa/Cairo', 'ar', 'saturday', ?, ?)`,
        args: [anonUserId, now, now],
      });
      prefs = {
        anonymous_user_id: anonUserId,
        timezone: 'Africa/Cairo',
        locale: 'ar',
        week_start_day: 'saturday',
        created_at: now,
        updated_at: now,
      };
    }

    res.json({ preferences: prefs });
  } catch (err) {
    console.error('GET /api/preferences Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحميل إعدادات التطبيق.');
  }
});

// PUT /api/preferences
router.put('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const body = req.body || {};
    const now = new Date().toISOString();

    const timezone = body.timezone || 'Africa/Cairo';
    const locale = body.locale || 'ar';
    const weekStartDay = body.week_start_day || body.week_starts_on || body.weekStartsOn || 'saturday';
    const notifPrefs = body.notification_preferences ? (typeof body.notification_preferences === 'string' ? body.notification_preferences : JSON.stringify(body.notification_preferences)) : null;

    await db.execute({
      sql: `INSERT INTO user_preferences (anonymous_user_id, timezone, locale, week_start_day, notification_preferences, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(anonymous_user_id) DO UPDATE SET
              timezone = excluded.timezone,
              locale = excluded.locale,
              week_start_day = excluded.week_start_day,
              notification_preferences = excluded.notification_preferences,
              updated_at = excluded.updated_at`,
      args: [anonUserId, timezone, locale, weekStartDay, notifPrefs, now, now],
    });

    const updated = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
      args: [anonUserId],
    });

    res.json({ preferences: updated });
  } catch (err) {
    console.error('PUT /api/preferences Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر حفظ إعدادات التطبيق.');
  }
});

export default router;
