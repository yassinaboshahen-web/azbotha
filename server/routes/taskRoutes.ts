import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryOne, queryMany } from '../db/client';
import { isValidId, isValidDateString, sanitizeText, sendError } from '../utils/validation';

const router = Router();

// GET /api/tasks
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const { date, completed } = req.query;

    let sql = 'SELECT * FROM tasks WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\')';
    const args: any[] = [anonUserId];

    if (typeof date === 'string' && isValidDateString(date)) {
      sql += ' AND due_date = ?';
      args.push(date);
    }

    if (completed !== undefined) {
      const isComp = completed === 'true' || completed === '1';
      sql += ' AND status = ?';
      args.push(isComp ? 'completed' : 'pending');
    }

    sql += ' ORDER BY due_date ASC, created_at DESC';

    const rows = await queryMany<Record<string, any>>({ sql, args });

    const tasks = rows.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      description: t.description ? String(t.description) : undefined,
      notes: t.description ? String(t.description) : undefined,
      due_date: t.due_date ? String(t.due_date) : undefined,
      date: t.due_date ? String(t.due_date) : undefined,
      due_time: t.due_time ? String(t.due_time) : undefined,
      priority: String(t.priority || 'normal'),
      status: String(t.status || 'pending'),
      completed: t.status === 'completed' || Boolean(t.completed_at),
      completed_at: t.completed_at ? String(t.completed_at) : undefined,
      category: t.category ? String(t.category) : 'عام',
      reminder: Boolean(t.reminder),
      created_at: String(t.created_at),
      updated_at: String(t.updated_at),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('GET /api/tasks Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحميل المهام.');
  }
});

// POST /api/tasks
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const body = req.body || {};

    const rawTitle = body.title;
    if (!rawTitle || typeof rawTitle !== 'string' || rawTitle.trim().length === 0) {
      sendError(res, 400, 'ValidationError', 'عنوان المهمة مطلوب.');
      return;
    }

    const title = sanitizeText(rawTitle, 300);
    const description = sanitizeText(body.description || body.notes || '', 5000) || null;
    const dueDate = body.dueDate || body.date || body.due_date;
    if (dueDate && !isValidDateString(dueDate)) {
      sendError(res, 400, 'ValidationError', 'تاريخ المهمة غير صالح.');
      return;
    }

    const dueTime = body.dueTime || body.time || body.due_time || null;
    const priority = body.priority || 'normal';
    const category = sanitizeText(body.category || 'عام', 100);
    const reminder = body.reminder || body.reminderEnabled ? 1 : 0;
    const status = body.completed || body.status === 'completed' ? 'completed' : 'pending';

    const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const completedAt = status === 'completed' ? now : null;

    await db.execute({
      sql: `INSERT INTO tasks (id, anonymous_user_id, title, description, due_date, due_time, priority, status, completed_at, created_at, updated_at, category, reminder, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      args: [taskId, anonUserId, title, description, dueDate || null, dueTime, priority, status, completedAt, now, now, category, reminder],
    });

    const task = {
      id: taskId,
      title,
      description: description || undefined,
      notes: description || undefined,
      due_date: dueDate || undefined,
      date: dueDate || undefined,
      due_time: dueTime || undefined,
      priority,
      status,
      completed: status === 'completed',
      completed_at: completedAt || undefined,
      category,
      reminder: Boolean(reminder),
      created_at: now,
      updated_at: now,
    };

    res.status(201).json({ task });
  } catch (err) {
    console.error('POST /api/tasks Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر إنشاء المهمة.');
  }
});

// PATCH /api/tasks/:id/complete
router.patch('/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      sendError(res, 400, 'ValidationError', 'معرف المهمة غير صالح.');
      return;
    }

    const { completed } = req.body || {};
    const isCompleted = Boolean(completed);
    const status = isCompleted ? 'completed' : 'pending';
    const now = new Date().toISOString();
    const completedAt = isCompleted ? now : null;

    const result = await db.execute({
      sql: `UPDATE tasks 
            SET status = ?, completed_at = ?, updated_at = ?
            WHERE id = ? AND anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      args: [status, completedAt, now, taskId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'المهمة غير موجودة.');
      return;
    }

    res.json({ success: true, id: taskId, completed: isCompleted, status });
  } catch (err) {
    console.error('PATCH /api/tasks/:id/complete Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحديث حالة المهمة.');
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      sendError(res, 400, 'ValidationError', 'معرف المهمة غير صالح.');
      return;
    }

    const body = req.body || {};
    const now = new Date().toISOString();

    const title = body.title !== undefined ? sanitizeText(body.title, 300) : null;
    const description = body.description !== undefined ? sanitizeText(body.description, 5000) : body.notes !== undefined ? sanitizeText(body.notes, 5000) : null;
    const dueDate = body.dueDate !== undefined ? body.dueDate : body.due_date !== undefined ? body.due_date : body.date !== undefined ? body.date : null;
    const dueTime = body.dueTime !== undefined ? body.dueTime : body.due_time !== undefined ? body.due_time : body.time !== undefined ? body.time : null;
    const priority = body.priority !== undefined ? body.priority : null;
    const category = body.category !== undefined ? sanitizeText(body.category, 100) : null;
    const reminder = body.reminder !== undefined ? (body.reminder ? 1 : 0) : null;

    const result = await db.execute({
      sql: `UPDATE tasks
            SET title = COALESCE(?, title),
                description = COALESCE(?, description),
                due_date = COALESCE(?, due_date),
                due_time = COALESCE(?, due_time),
                priority = COALESCE(?, priority),
                category = COALESCE(?, category),
                reminder = COALESCE(?, reminder),
                updated_at = ?
            WHERE id = ? AND anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      args: [title, description, dueDate, dueTime, priority, category, reminder, now, taskId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'المهمة غير موجودة.');
      return;
    }

    const updated = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM tasks WHERE id = ? AND anonymous_user_id = ?',
      args: [taskId, anonUserId],
    });

    res.json({ task: updated });
  } catch (err) {
    console.error('PATCH /api/tasks/:id Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحديث المهمة.');
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      sendError(res, 400, 'ValidationError', 'معرف المهمة غير صالح.');
      return;
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: 'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND anonymous_user_id = ?',
      args: [now, now, taskId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'المهمة غير موجودة.');
      return;
    }

    res.json({ success: true, message: 'تم حذف المهمة بنجاح.' });
  } catch (err) {
    console.error('DELETE /api/tasks/:id Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر حذف المهمة.');
  }
});

export default router;
