import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryMany } from '../db/client';
import { isValidId, sendError } from '../utils/validation';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;

    const rows = await queryMany<Record<string, any>>({
      sql: 'SELECT * FROM notifications WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\') ORDER BY created_at DESC',
      args: [anonUserId],
    });

    const notifications = rows.map((n) => ({
      id: String(n.id),
      type: String(n.type || 'upcoming'),
      title: String(n.title),
      message: String(n.body || ''),
      subtitle: String(n.body || ''),
      body: String(n.body || ''),
      read: Boolean(n.read),
      created_at: String(n.created_at),
      updated_at: n.updated_at ? String(n.updated_at) : undefined,
    }));

    res.json({ notifications });
  } catch (err) {
    console.error('GET /api/notifications Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحميل التنبيهات.');
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const notifId = req.params.id;

    if (!isValidId(notifId)) {
      sendError(res, 400, 'ValidationError', 'معرف التنبيه غير صالح.');
      return;
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: 'UPDATE notifications SET read = 1, updated_at = ? WHERE id = ? AND anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\')',
      args: [now, notifId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'التنبيه غير موجود.');
      return;
    }

    res.json({ success: true, id: notifId, read: true });
  } catch (err) {
    console.error('PATCH /api/notifications/:id/read Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحديث التنبيه.');
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const now = new Date().toISOString();

    await db.execute({
      sql: 'UPDATE notifications SET read = 1, updated_at = ? WHERE anonymous_user_id = ? AND read = 0 AND (deleted_at IS NULL OR deleted_at = \'\')',
      args: [now, anonUserId],
    });

    res.json({ success: true, message: 'تم تحديد جميع التنبيهات كمقروءة.' });
  } catch (err) {
    console.error('POST /api/notifications/read-all Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحديث التنبيهات.');
  }
});

export default router;
