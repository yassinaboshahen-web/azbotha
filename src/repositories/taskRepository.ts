import { getDB, getInMemoryStore } from './dbEngine';
import { TaskRecord } from '../types';
import { identityService } from '../services/identity';

export const taskRepository = {
  /**
   * Create a new task record in IndexedDB.
   */
  async createTask(
    data: Omit<TaskRecord, 'id' | 'anonymous_user_id' | 'created_at' | 'updated_at'> & {
      id?: string;
      anonymous_user_id?: string;
    }
  ): Promise<TaskRecord> {
    const anonId = data.anonymous_user_id || identityService.getAnonymousUserId();
    const id = data.id || `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const taskDate = (data.due_date && /^\d{4}-\d{2}-\d{2}$/.test(data.due_date))
      ? data.due_date
      : (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date))
      ? data.date
      : (data.due_date || data.date || '');

    const task: TaskRecord = {
      id,
      anonymous_user_id: anonId,
      title: data.title,
      description: data.description || data.notes || '',
      due_date: taskDate,
      due_time: data.due_time || '',
      priority: data.priority || 'normal',
      completed: Boolean(data.completed),
      completed_at: data.completed ? now : undefined,
      created_at: now,
      updated_at: now,
      category: data.category || 'عام',
      reminder: Boolean(data.reminder),
      notes: data.notes || data.description || '',
      date: taskDate,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('tasks', task);
      } catch (err) {
        console.warn('taskRepository.createTask DB put error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('tasks').set(task.id, task);
    }

    return task;
  },

  /**
   * Get a single task by ID.
   */
  async getTask(id: string): Promise<TaskRecord | null> {
    const db = await getDB();
    if (db) {
      try {
        const task = await db.get('tasks', id);
        return task || null;
      } catch (err) {
        console.warn('taskRepository.getTask DB error:', err);
      }
    }
    return getInMemoryStore('tasks').get(id) || null;
  },

  /**
   * Get all tasks with optional filters (by date and/or completion state).
   */
  async getTasks(filter?: { date?: string; completed?: boolean }): Promise<TaskRecord[]> {
    const db = await getDB();
    let all: TaskRecord[] = [];

    if (db) {
      try {
        all = await db.getAll('tasks');
      } catch (err) {
        console.warn('taskRepository.getTasks DB error:', err);
        all = Array.from(getInMemoryStore('tasks').values());
      }
    } else {
      all = Array.from(getInMemoryStore('tasks').values());
    }

    // Apply filters
    if (filter) {
      if (filter.date !== undefined) {
        all = all.filter((t) => t.due_date === filter.date || t.date === filter.date);
      }
      if (filter.completed !== undefined) {
        all = all.filter((t) => Boolean(t.completed) === Boolean(filter.completed));
      }
    }

    return all;
  },

  /**
   * Update an existing task record.
   */
  async updateTask(id: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> {
    const existing = await this.getTask(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: TaskRecord = {
      ...existing,
      ...updates,
      due_date: updates.due_date !== undefined ? updates.due_date : updates.date !== undefined ? updates.date : existing.due_date,
      date: updates.due_date !== undefined ? updates.due_date : updates.date !== undefined ? updates.date : existing.date,
      description: updates.description !== undefined ? updates.description : updates.notes !== undefined ? updates.notes : existing.description,
      notes: updates.description !== undefined ? updates.description : updates.notes !== undefined ? updates.notes : existing.notes,
      updated_at: now,
    };

    const db = await getDB();
    if (db) {
      try {
        await db.put('tasks', updated);
      } catch (err) {
        console.warn('taskRepository.updateTask DB error:', err);
        throw err;
      }
    } else {
      getInMemoryStore('tasks').set(id, updated);
    }

    return updated;
  },

  /**
   * Mark a task as completed or incomplete.
   */
  async completeTask(id: string, completed: boolean): Promise<TaskRecord | null> {
    const now = new Date().toISOString();
    return await this.updateTask(id, {
      completed,
      completed_at: completed ? now : undefined,
    });
  },

  /**
   * Delete a task record.
   */
  async deleteTask(id: string): Promise<boolean> {
    const db = await getDB();
    if (db) {
      try {
        await db.delete('tasks', id);
      } catch (err) {
        console.warn('taskRepository.deleteTask DB error:', err);
      }
    }
    getInMemoryStore('tasks').delete(id);
    return true;
  },
};
