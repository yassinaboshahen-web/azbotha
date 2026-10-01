import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryMany } from '../db/client';
import { isValidId, sanitizeText, sendError } from '../utils/validation';

const router = Router();

// GET /api/reminders
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;

    const rows = await queryMany<Record<string, any>>({
      sql: 'SELECT * FROM reminders WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\') ORDER BY created_at DESC',
      args: [anonUserId],
    });

    const reminders = rows.map((r) => {
      let tc: any = {};
      if (r.trigger_configuration) {
        try {
          tc = typeof r.trigger_configuration === 'string' ? JSON.parse(r.trigger_configuration) : r.trigger_configuration;
        } catch {
          // ignore
        }
      }

      return {
        id: String(r.id),
        entity_id: r.entity_id ? String(r.entity_id) : undefined,
        entity_type: String(r.entity_type || 'custom'),
        reminder_type: String(r.reminder_type || 'custom'),
        enabled: Boolean(r.enabled),
        title: tc.title || undefined,
        scheduled_for: tc.scheduledFor || tc.scheduled_for || undefined,
        message: tc.message || undefined,
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      };
    });

    res.json({ reminders });
  } catch (err) {
    console.error('GET /api/reminders Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحميل التذكيرات.');
  }
});

// POST /api/reminders
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const body = req.body || {};

    const title = sanitizeText(body.title || 'تذكير جديد', 300);
    const scheduledFor = body.scheduledFor || body.scheduled_for || new Date().toISOString();
    const type = body.type || body.reminder_type || 'custom';
    const entityId = body.eventId || body.taskId || body.entity_id || null;
    const entityType = body.eventId ? 'event' : body.taskId ? 'task' : (body.entity_type || 'custom');

    const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const tc = JSON.stringify({
      title,
      scheduledFor,
      message: body.message || null,
      taskId: body.taskId || null,
      eventId: body.eventId || null,
    });

    await db.execute({
      sql: `INSERT INTO reminders (id, anonymous_user_id, entity_id, entity_type, reminder_type, trigger_configuration, enabled, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)`,
      args: [reminderId, anonUserId, entityId, entityType, type, tc, now, now],
    });

    const reminder = {
      id: reminderId,
      entity_id: entityId || undefined,
      entity_type: entityType,
      reminder_type: type,
      enabled: true,
      title,
      scheduled_for: scheduledFor,
      message: body.message || undefined,
      created_at: now,
      updated_at: now,
    };

    res.status(201).json({ reminder });
  } catch (err) {
    console.error('POST /api/reminders Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر إنشاء التذكير.');
  }
});

// POST /api/reminders/:id/dismiss
router.post('/:id/dismiss', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const reminderId = req.params.id;

    if (!isValidId(reminderId)) {
      sendError(res, 400, 'ValidationError', 'معرف التذكير غير صالح.');
      return;
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: 'UPDATE reminders SET enabled = 0, updated_at = ? WHERE id = ? AND anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\')',
      args: [now, reminderId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'التذكير غير موجود.');
      return;
    }

    res.json({ success: true, message: 'تم إلغاء التذكير.' });
  } catch (err) {
    console.error('POST /api/reminders/:id/dismiss Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر إلغاء التذكير.');
  }
});

export default router;
