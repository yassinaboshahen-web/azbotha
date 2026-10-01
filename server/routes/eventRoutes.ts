import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db, queryOne, queryMany } from '../db/client';
import { isValidId, isValidDateString, sanitizeText, sendError } from '../utils/validation';

const router = Router();

// GET /api/events
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const { date, startDate, endDate } = req.query;

    let sql = 'SELECT * FROM events WHERE anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = \'\')';
    const args: any[] = [anonUserId];

    if (typeof date === 'string' && isValidDateString(date)) {
      sql += ' AND date = ?';
      args.push(date);
    } else if (typeof startDate === 'string' && isValidDateString(startDate) && typeof endDate === 'string' && isValidDateString(endDate)) {
      sql += ' AND date BETWEEN ? AND ?';
      args.push(startDate, endDate);
    }

    sql += ' ORDER BY date ASC, start_time ASC';

    const rows = await queryMany<Record<string, any>>({ sql, args });

    const events = rows.map((e) => ({
      id: String(e.id),
      title: String(e.title),
      date: String(e.date),
      event_date: String(e.date),
      time: String(e.start_time),
      start_time: String(e.start_time),
      end_time: e.end_time ? String(e.end_time) : undefined,
      endTime: e.end_time ? String(e.end_time) : undefined,
      category: String(e.category || 'custom'),
      category_label: String(e.category_label || 'معاد'),
      categoryLabel: String(e.category_label || 'معاد'),
      location: e.location ? String(e.location) : undefined,
      doctor_or_ta: e.doctor_or_ta ? String(e.doctor_or_ta) : undefined,
      instructor: e.doctor_or_ta ? String(e.doctor_or_ta) : undefined,
      person: e.doctor_or_ta ? String(e.doctor_or_ta) : undefined,
      course: e.course ? String(e.course) : undefined,
      notes: e.notes ? String(e.notes) : undefined,
      description: e.notes ? String(e.notes) : undefined,
      completed: e.status === 'completed',
      status: String(e.status || 'upcoming'),
      reminder: Boolean(e.reminder),
      reminder_enabled: Boolean(e.reminder),
      created_at: String(e.created_at),
      updated_at: String(e.updated_at),
    }));

    res.json({ events });
  } catch (err) {
    console.error('GET /api/events Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحميل المواعيد.');
  }
});

// POST /api/events
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const body = req.body || {};

    const rawTitle = body.title;
    if (!rawTitle || typeof rawTitle !== 'string' || rawTitle.trim().length === 0) {
      sendError(res, 400, 'ValidationError', 'عنوان المعاد مطلوب.');
      return;
    }

    const title = sanitizeText(rawTitle, 300);
    const date = body.eventDate || body.date;
    if (!date || !isValidDateString(date)) {
      sendError(res, 400, 'ValidationError', 'تاريخ المعاد غير صالح.');
      return;
    }

    const startTime = body.startTime || body.start_time || body.time || '09:00';
    const endTime = body.endTime || body.end_time || null;
    const location = sanitizeText(body.location, 300) || null;
    const doctorOrTa = sanitizeText(body.doctor_or_ta || body.person || body.instructor, 300) || null;
    const course = sanitizeText(body.course, 200) || null;
    const notes = sanitizeText(body.notes || body.description, 5000) || null;
    const category = sanitizeText(body.category || 'custom', 100);
    const categoryLabel = sanitizeText(body.categoryLabel || body.category_label || 'معاد', 100);
    const reminder = body.reminderEnabled !== undefined ? (body.reminderEnabled ? 1 : 0) : (body.reminder ? 1 : 0);
    const status = body.completed ? 'completed' : 'upcoming';

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO events (id, anonymous_user_id, title, date, start_time, end_time, location, doctor_or_ta, course, notes, status, created_at, updated_at, category, category_label, reminder, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      args: [eventId, anonUserId, title, date, startTime, endTime, location, doctorOrTa, course, notes, status, now, now, category, categoryLabel, reminder],
    });

    const event = {
      id: eventId,
      title,
      date,
      event_date: date,
      time: startTime,
      start_time: startTime,
      end_time: endTime || undefined,
      endTime: endTime || undefined,
      category,
      category_label: categoryLabel,
      categoryLabel,
      location: location || undefined,
      doctor_or_ta: doctorOrTa || undefined,
      instructor: doctorOrTa || undefined,
      person: doctorOrTa || undefined,
      course: course || undefined,
      notes: notes || undefined,
      description: notes || undefined,
      completed: status === 'completed',
      status,
      reminder: Boolean(reminder),
      reminder_enabled: Boolean(reminder),
      created_at: now,
      updated_at: now,
    };

    res.status(201).json({ event });
  } catch (err) {
    console.error('POST /api/events Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر إنشاء المعاد.');
  }
});

// PATCH /api/events/:id
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const eventId = req.params.id;

    if (!isValidId(eventId)) {
      sendError(res, 400, 'ValidationError', 'معرف المعاد غير صالح.');
      return;
    }

    const body = req.body || {};
    const now = new Date().toISOString();

    const title = body.title !== undefined ? sanitizeText(body.title, 300) : null;
    const date = body.eventDate !== undefined ? body.eventDate : body.date !== undefined ? body.date : null;
    const startTime = body.startTime !== undefined ? body.startTime : body.start_time !== undefined ? body.start_time : body.time !== undefined ? body.time : null;
    const endTime = body.endTime !== undefined ? body.endTime : body.end_time !== undefined ? body.end_time : null;
    const location = body.location !== undefined ? sanitizeText(body.location, 300) : null;
    const doctorOrTa = body.person !== undefined ? sanitizeText(body.person, 300) : body.doctor_or_ta !== undefined ? sanitizeText(body.doctor_or_ta, 300) : body.instructor !== undefined ? sanitizeText(body.instructor, 300) : null;
    const course = body.course !== undefined ? sanitizeText(body.course, 200) : null;
    const notes = body.description !== undefined ? sanitizeText(body.description, 5000) : body.notes !== undefined ? sanitizeText(body.notes, 5000) : null;
    const status = body.completed !== undefined ? (body.completed ? 'completed' : 'upcoming') : body.status !== undefined ? body.status : null;
    const category = body.category !== undefined ? sanitizeText(body.category, 100) : null;
    const categoryLabel = body.categoryLabel !== undefined ? sanitizeText(body.categoryLabel, 100) : body.category_label !== undefined ? sanitizeText(body.category_label, 100) : null;
    const reminder = body.reminderEnabled !== undefined ? (body.reminderEnabled ? 1 : 0) : body.reminder !== undefined ? (body.reminder ? 1 : 0) : null;

    const result = await db.execute({
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
                category = COALESCE(?, category),
                category_label = COALESCE(?, category_label),
                reminder = COALESCE(?, reminder),
                updated_at = ?
            WHERE id = ? AND anonymous_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
      args: [title, date, startTime, endTime, location, doctorOrTa, course, notes, status, category, categoryLabel, reminder, now, eventId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'المعاد غير موجود.');
      return;
    }

    const updated = await queryOne<Record<string, any>>({
      sql: 'SELECT * FROM events WHERE id = ? AND anonymous_user_id = ?',
      args: [eventId, anonUserId],
    });

    res.json({ event: updated });
  } catch (err) {
    console.error('PATCH /api/events/:id Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر تحديث المعاد.');
  }
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const anonUserId = req.user!.anonymous_user_id || req.user!.id;
    const eventId = req.params.id;

    if (!isValidId(eventId)) {
      sendError(res, 400, 'ValidationError', 'معرف المعاد غير صالح.');
      return;
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: 'UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ? AND anonymous_user_id = ?',
      args: [now, now, eventId, anonUserId],
    });

    if (result.rowsAffected === 0) {
      sendError(res, 404, 'NotFoundError', 'المعاد غير موجود.');
      return;
    }

    res.json({ success: true, message: 'تم حذف المعاد بنجاح.' });
  } catch (err) {
    console.error('DELETE /api/events/:id Error:', err);
    sendError(res, 500, 'ServerError', 'تعذر حذف المعاد.');
  }
});

export default router;
