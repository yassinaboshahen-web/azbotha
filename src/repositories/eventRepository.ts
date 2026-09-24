import { getDB, getInMemoryStore } from './dbEngine';
import { EventRecord } from '../types';
import { identityService } from '../services/identity';

export const eventRepository = {
  /**
   * Create a new event/appointment record.
   */
  async createEvent(
    data: Omit<EventRecord, 'id' | 'anonymous_user_id' | 'created_at' | 'updated_at'> & {
      id?: string;
      anonymous_user_id?: string;
    }
  ): Promise<EventRecord> {
    const anonId = data.anonymous_user_id || identityService.getAnonymousUserId();
    const id = data.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const event: EventRecord = {
      id,
      anonymous_user_id: anonId,
      title: data.title,
      date: data.date,
      start_time: data.start_time || data.time || '09:00',
      end_time: data.end_time || data.endTime || '10:00',
      time: data.start_time || data.time || '09:00',
      endTime: data.end_time || data.endTime || '10:00',
      location: data.location || '',
      doctor_or_ta: data.doctor_or_ta || data.instructor || '',
      instructor: data.doctor_or_ta || data.instructor || '',
      course: data.course || '',
      notes: data.notes || '',
      category: data.category || 'custom',
      categoryLabel: data.categoryLabel || 'معاد',
      reminder: Boolean(data.reminder),
      status: data.status || 'confirmed',
      completed: Boolean(data.completed),
      created_at: now,
      updated_at: now,
      priority: data.priority || 'normal',
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('events', event);
      } catch (err) {
        console.warn('eventRepository.createEvent DB put error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('events').set(event.id, event);
    }

    return event;
  },

  /**
   * Get a single event by ID.
   */
  async getEvent(id: string): Promise<EventRecord | null> {
    const db = await getDB();
    if (db) {
      try {
        const evt = await db.get('events', id);
        return evt || null;
      } catch (err) {
        console.warn('eventRepository.getEvent DB error:', err);
      }
    }
    return getInMemoryStore('events').get(id) || null;
  },

  /**
   * Get all events matching optional date or date-range filter.
   */
  async getEvents(filter?: { date?: string; startDate?: string; endDate?: string }): Promise<EventRecord[]> {
    const db = await getDB();
    let all: EventRecord[] = [];

    if (db) {
      try {
        all = await db.getAll('events');
      } catch (err) {
        console.warn('eventRepository.getEvents DB error:', err);
        all = Array.from(getInMemoryStore('events').values());
      }
    } else {
      all = Array.from(getInMemoryStore('events').values());
    }

    if (filter) {
      if (filter.date) {
        all = all.filter((e) => e.date === filter.date);
      } else if (filter.startDate && filter.endDate) {
        all = all.filter((e) => e.date >= filter.startDate! && e.date <= filter.endDate!);
      }
    }

    return all;
  },

  /**
   * Update an existing event record.
   */
  async updateEvent(id: string, updates: Partial<EventRecord>): Promise<EventRecord | null> {
    const existing = await this.getEvent(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: EventRecord = {
      ...existing,
      ...updates,
      start_time: updates.start_time || updates.time || existing.start_time,
      time: updates.start_time || updates.time || existing.time,
      end_time: updates.end_time || updates.endTime || existing.end_time,
      endTime: updates.end_time || updates.endTime || existing.endTime,
      doctor_or_ta: updates.doctor_or_ta || updates.instructor || existing.doctor_or_ta,
      instructor: updates.doctor_or_ta || updates.instructor || existing.instructor,
      updated_at: now,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('events', updated);
      } catch (err) {
        console.warn('eventRepository.updateEvent DB error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('events').set(id, updated);
    }

    return updated;
  },

  /**
   * Delete an event record.
   */
  async deleteEvent(id: string): Promise<boolean> {
    const db = await getDB();
    if (db) {
      try {
        await db.delete('events', id);
      } catch (err) {
        console.warn('eventRepository.deleteEvent DB error:', err);
      }
    }
    getInMemoryStore('events').delete(id);
    return true;
  },
};
