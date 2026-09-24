import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryMany } from '../db/client';

const router = Router();

const ALLOWED_ENTITY_TYPES = new Set([
  'task',
  'event',
  'reminder',
  'notification',
  'user_preferences',
  'preference',
]);

const ALLOWED_OPERATIONS = new Set(['create', 'update', 'delete']);

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 128;
}

function isValidDateString(dateStr: unknown): boolean {
  if (!dateStr) return true;
  if (typeof dateStr !== 'string') return false;
  return !isNaN(Date.parse(dateStr)) || /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/**
 * POST /api/sync/push
 * Push validated offline operations to Turso cloud database using parameterized SQL.
 */
router.post('/push', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const body = req.body;

    let opsToProcess: Array<Record<string, any>> = [];

    if (Array.isArray(body)) {
      opsToProcess = body;
    } else if (body && Array.isArray(body.operations)) {
      opsToProcess = body.operations;
    } else if (body && typeof body === 'object' && body.entity_type) {
      opsToProcess = [body];
    }

    if (opsToProcess.length > 100) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'عدد العمليات كبير جداً. أقصى حد هو 100 عملية.',
      });
      return;
    }

    let processedCount = 0;
    const now = new Date().toISOString();

    for (const op of opsToProcess) {
      if (!op || typeof op !== 'object') {
        res.status(400).json({
          error: 'ValidationError',
          message: 'صيغة العملية غير صالحة.',
        });
        return;
      }

      const entityType = String(op.entity_type || op.entityType || '').toLowerCase();
      const operationType = String(op.operation_type || op.action || '').toLowerCase();
      const entityId = op.entity_id || op.entityId;
      const payload = op.payload || op;

      if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `نوع الكيان غير مدعوم: ${entityType}`,
        });
        return;
      }

      if (!ALLOWED_OPERATIONS.has(operationType)) {
        res.status(400).json({
          error: 'ValidationError',
          message: `نوع العملية غير مدعوم: ${operationType}`,
        });
        return;
      }

      if (operationType !== 'create' && entityType !== 'user_preferences' && entityType !== 'preference' && !isValidId(entityId)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'معرف الكيان غير صالح.',
        });
        return;
      }

      const dateVal = payload.due_date || payload.date || payload.event_date;
      if (dateVal && !isValidDateString(dateVal)) {
        res.status(400).json({
          error: 'ValidationError',
          message: 'تاريخ غير صالح في بيانات المزامنة.',
        });
        return;
      }

      // Record Sync Operation log in sync_operations table
      const syncOpId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        await db.execute({
          sql: `INSERT INTO sync_operations (id, anonymous_user_id, entity_type, entity_id, operation_type, payload, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            syncOpId,
            anonUserId,
            entityType,
            String(entityId || 'none'),
            operationType,
            JSON.stringify(payload),
            'synced',
            now,
            now,
          ],
        });
      } catch {
        // Table fallback handle
      }

      // Execute Parameterized SQL Queries per Entity
      if (entityType === 'task') {
        const taskId = String(entityId || payload.id || `tsk_${Date.now()}`);
        if (!isValidId(taskId)) {
          res.status(400).json({ error: 'ValidationError', message: 'معرف المهمة غير صالح.' });
          return;
        }

        if (operationType === 'create') {
          await db.execute({
            sql: `INSERT INTO tasks (id, anonymous_user_id, title, description, due_date, due_time, priority, status, completed_at, created_at, updated_at, category, reminder)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    due_date = excluded.due_date,
                    due_time = excluded.due_time,
                    priority = excluded.priority,
                    status = excluded.status,
                    completed_at = excluded.completed_at,
                    updated_at = excluded.updated_at,
                    category = excluded.category,
                    reminder = excluded.reminder
                  WHERE tasks.anonymous_user_id = ?`,
            args: [
              taskId,
              anonUserId,
              String(payload.title || 'مهمة جديدة'),
              payload.description || payload.notes || null,
              payload.due_date || payload.date || null,
              payload.due_time || payload.time || null,
              payload.priority || 'normal',
              payload.status || (payload.completed ? 'completed' : 'pending'),
              payload.completed ? (payload.completed_at || now) : null,
              payload.created_at || now,
              now,
              payload.category || null,
              payload.reminder ? 1 : 0,
              anonUserId
            ],
          });
        } else if (operationType === 'update') {
          await db.execute({
            sql: `UPDATE tasks
                  SET title = COALESCE(?, title),
                      description = COALESCE(?, description),
                      due_date = COALESCE(?, due_date),
                      due_time = COALESCE(?, due_time),
                      priority = COALESCE(?, priority),
                      status = COALESCE(?, status),
                      completed_at = COALESCE(?, completed_at),
                      updated_at = ?,
                      category = COALESCE(?, category),
                      reminder = COALESCE(?, reminder)
                  WHERE id = ? AND anonymous_user_id = ?`,
            args: [
              payload.title !== undefined ? String(payload.title) : null,
              payload.description !== undefined ? String(payload.description) : payload.notes !== undefined ? String(payload.notes) : null,
              payload.due_date !== undefined ? String(payload.due_date) : payload.date !== undefined ? String(payload.date) : null,
              payload.due_time !== undefined ? String(payload.due_time) : null,
              payload.priority !== undefined ? String(payload.priority) : null,
              payload.status !== undefined ? String(payload.status) : payload.completed !== undefined ? (payload.completed ? 'completed' : 'pending') : null,
              payload.completed !== undefined ? (payload.completed ? (payload.completed_at || now) : null) : null,
              now,
              payload.category || null,
              payload.reminder !== undefined ? (payload.reminder ? 1 : 0) : null,
              taskId,
              anonUserId
            ],
          });
        } else if (operationType === 'delete') {
          await db.execute({
            sql: 'DELETE FROM tasks WHERE id = ? AND anonymous_user_id = ?',
            args: [taskId, anonUserId],
          });
        }
      } else if (entityType === 'event') {
        const eventId = String(entityId || payload.id || `evt_${Date.now()}`);
        if (!isValidId(eventId)) {
          res.status(400).json({ error: 'ValidationError', message: 'معرف المعاد غير صالح.' });
          return;
        }

        if (operationType === 'create') {
          await db.execute({
            sql: `INSERT INTO events (id, anonymous_user_id, title, date, start_time, end_time, location, doctor_or_ta, course, notes, status, created_at, updated_at, category, category_label, reminder)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    date = excluded.date,
                    start_time = excluded.start_time,
                    end_time = excluded.end_time,
                    location = excluded.location,
                    doctor_or_ta = excluded.doctor_or_ta,
                    course = excluded.course,
                    notes = excluded.notes,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    category = excluded.category,
                    category_label = excluded.category_label,
                    reminder = excluded.reminder
                  WHERE events.anonymous_user_id = ?`,
            args: [
              eventId,
              anonUserId,
              String(payload.title || 'معاد جديد'),
              String(payload.date || payload.event_date || now.split('T')[0]),
              String(payload.start_time || payload.time || '09:00'),
              payload.end_time || payload.endTime || null,
              payload.location || null,
              payload.doctor_or_ta || payload.instructor || payload.person || null,
              payload.course || null,
              payload.notes || payload.description || null,
              payload.status || (payload.completed ? 'completed' : 'upcoming'),
              payload.created_at || now,
              now,
              payload.category || null,
              payload.categoryLabel || payload.category_label || null,
              payload.reminder ? 1 : 0,
              anonUserId
            ],
          });
        } else if (operationType === 'update') {
          await db.execute({
            sql: `UPDATE events
                  SET title = COALESCE(?, title),
                      date = COALESCE(?, date),
                      start_time = COALESCE(?, start_time),
                      end_time = COALESCE(?, end_time),
                      location = COALESCE(?, location),
                      doctor_or_ta = COALESCE(?, doctor_or_ta),
                      course = COALESCE(?, course),
                      notes = COALESCE(?, notes),
                      status = COALESCE(?, status),
                      updated_at = ?,
                      category = COALESCE(?, category),
                      category_label = COALESCE(?, category_label),
                      reminder = COALESCE(?, reminder)
                  WHERE id = ? AND anonymous_user_id = ?`,
            args: [
              payload.title !== undefined ? String(payload.title) : null,
              payload.date !== undefined ? String(payload.date) : payload.event_date !== undefined ? String(payload.event_date) : null,
              payload.start_time !== undefined ? String(payload.start_time) : payload.time !== undefined ? String(payload.time) : null,
              payload.end_time !== undefined ? String(payload.end_time) : payload.endTime !== undefined ? String(payload.endTime) : null,
              payload.location !== undefined ? String(payload.location) : null,
              payload.doctor_or_ta !== undefined ? String(payload.doctor_or_ta) : payload.instructor !== undefined ? String(payload.instructor) : null,
              payload.course !== undefined ? String(payload.course) : null,
              payload.notes !== undefined ? String(payload.notes) : payload.description !== undefined ? String(payload.description) : null,
              payload.status !== undefined ? String(payload.status) : payload.completed !== undefined ? (payload.completed ? 'completed' : 'upcoming') : null,
              now,
              payload.category || null,
              payload.categoryLabel || payload.category_label || null,
              payload.reminder !== undefined ? (payload.reminder ? 1 : 0) : null,
              eventId,
              anonUserId
            ],
          });
        } else if (operationType === 'delete') {
          await db.execute({
            sql: 'DELETE FROM events WHERE id = ? AND anonymous_user_id = ?',
            args: [eventId, anonUserId],
          });
        }
      } else if (entityType === 'reminder') {
        const reminderId = String(entityId || payload.id || `rem_${Date.now()}`);
        if (!isValidId(reminderId)) {
          res.status(400).json({ error: 'ValidationError', message: 'معرف التذكير غير صالح.' });
          return;
        }

        if (operationType === 'create' || operationType === 'update') {
          await db.execute({
            sql: `INSERT INTO reminders (id, anonymous_user_id, entity_id, entity_type, reminder_type, trigger_configuration, enabled, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    entity_id = excluded.entity_id,
                    entity_type = excluded.entity_type,
                    reminder_type = excluded.reminder_type,
                    trigger_configuration = excluded.trigger_configuration,
                    enabled = excluded.enabled,
                    updated_at = excluded.updated_at`,
            args: [
              reminderId,
              anonUserId,
              payload.entity_id || payload.relatedId || null,
              payload.entity_type || payload.type || 'custom',
              payload.reminder_type || 'custom',
              payload.trigger_configuration ? JSON.stringify(payload.trigger_configuration) : null,
              payload.enabled !== undefined ? (payload.enabled ? 1 : 0) : 1,
              payload.created_at || now,
              now,
            ],
          });
        } else if (operationType === 'delete') {
          await db.execute({
            sql: 'DELETE FROM reminders WHERE id = ? AND (anonymous_user_id = ? OR anonymous_user_id = ?)',
            args: [reminderId, anonUserId, anonUserId],
          });
        }
      } else if (entityType === 'user_preferences' || entityType === 'preference') {
        await db.execute({
          sql: `INSERT INTO user_preferences (anonymous_user_id, timezone, locale, week_start_day, notification_preferences, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(anonymous_user_id) DO UPDATE SET
                  timezone = excluded.timezone,
                  locale = excluded.locale,
                  week_start_day = excluded.week_start_day,
                  notification_preferences = excluded.notification_preferences,
                  updated_at = excluded.updated_at`,
          args: [
            anonUserId,
            payload.timezone || 'Africa/Cairo',
            payload.locale || 'ar',
            payload.week_start_day || payload.week_starts_on || payload.weekStartsOn || 'saturday',
            payload.notification_preferences ? (typeof payload.notification_preferences === 'string' ? payload.notification_preferences : JSON.stringify(payload.notification_preferences)) : null,
            now,
            now,
          ],
        });
      } else if (entityType === 'notification') {
        const notifId = String(entityId || payload.id);
        if (isValidId(notifId)) {
          await db.execute({
            sql: 'UPDATE notifications SET read = ? WHERE id = ? AND (anonymous_user_id = ? OR anonymous_user_id = ?)',
            args: [payload.read ? 1 : 0, notifId, anonUserId, anonUserId],
          });
        }
      }

      processedCount += 1;
    }

    res.json({
      success: true,
      processedCount,
      timestamp: now,
    });
  } catch (err) {
    console.error('[Sync API Push Error]:', err instanceof Error ? err.message : String(err));
    res.status(500).json({
      error: 'SyncError',
      message: 'تعذر تع معالجة عمليات المزامنة.',
    });
  }
});

/**
 * POST /api/sync/pull
 * Retrieve cloud records associated with the authenticated anonymous installation identity.
 */
router.post('/pull', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;

    const [tasks, events, reminders, notifications, prefs] = await Promise.all([
      queryMany<Record<string, any>>({
        sql: 'SELECT * FROM tasks WHERE anonymous_user_id = ? ORDER BY created_at DESC',
        args: [anonUserId],
      }),
      queryMany<Record<string, any>>({
        sql: 'SELECT * FROM events WHERE anonymous_user_id = ? ORDER BY date ASC, start_time ASC',
        args: [anonUserId],
      }),
      queryMany<Record<string, any>>({
        sql: 'SELECT * FROM reminders WHERE anonymous_user_id = ? ORDER BY created_at DESC',
        args: [anonUserId],
      }),
      queryMany<Record<string, any>>({
        sql: 'SELECT * FROM notifications WHERE anonymous_user_id = ? ORDER BY created_at DESC',
        args: [anonUserId],
      }),
      queryMany<Record<string, any>>({
        sql: 'SELECT * FROM user_preferences WHERE anonymous_user_id = ?',
        args: [anonUserId],
      }),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      changes: {
        tasks,
        events,
        reminders,
        notifications,
        preferences: prefs.length > 0 ? prefs[0] : null,
      },
    });
  } catch (err) {
    console.error('[Sync API Pull Error]:', err instanceof Error ? err.message : String(err));
    res.status(500).json({
      error: 'SyncError',
      message: 'تعذر جلب البيانات من السيرفر.',
    });
  }
});

export default router;
