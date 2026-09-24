import { CalendarEvent, TaskItem, NotificationItem } from '../types';
import { identityService } from './identity';

export const apiClient = {
  isCloudSyncEnabled(): boolean {
    return Boolean(import.meta.env.VITE_API_BASE_URL);
  },

  getAnonymousUserId(): string {
    return identityService.getAnonymousUserId();
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const anonUserId = identityService.getAnonymousUserId();
    const token = identityService.getInstallationCredential() || anonUserId;
    headers.set('X-Anonymous-User-Id', anonUserId);
    headers.set('Authorization', `Bearer ${token}`);

    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const finalUrl = endpoint.startsWith('/') ? `${apiBaseUrl}${endpoint}` : endpoint;

    const response = await fetch(finalUrl, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('الجلسة انتهت، سجّل دخولك تاني.');
      }
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || 'مش قادرين نحفظها دلوقتي. جرّب تاني.');
    }

    return response.json() as Promise<T>;
  },

  // Tasks
  async getTasks(params?: { date?: string; completed?: boolean }): Promise<TaskItem[]> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.completed !== undefined) query.set('completed', String(params.completed));
    const data = await this.request<{ tasks: Array<Record<string, unknown>> }>(`/api/tasks?${query}`);
    return data.tasks.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      completed: Boolean(t.completed),
      date: t.due_date ? String(t.due_date) : undefined,
      priority: (t.priority as 'urgent' | 'normal' | 'light') || 'normal',
      category: t.category ? String(t.category) : 'عام',
      notes: t.description ? String(t.description) : undefined,
    }));
  },

  async createTask(task: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'urgent' | 'normal' | 'light';
    category?: string;
  }): Promise<TaskItem> {
    const data = await this.request<{ task: Record<string, unknown> }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    const t = data.task;
    return {
      id: String(t.id),
      title: String(t.title),
      completed: Boolean(t.completed),
      date: t.due_date ? String(t.due_date) : undefined,
      priority: (t.priority as 'urgent' | 'normal' | 'light') || 'normal',
      category: t.category ? String(t.category) : 'عام',
      notes: t.description ? String(t.description) : undefined,
    };
  },

  async completeTask(taskId: string, completed: boolean): Promise<void> {
    await this.request(`/api/tasks/${taskId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  },

  async updateTask(taskId: string, updates: { title?: string; category?: string }): Promise<void> {
    await this.request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    await this.request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  // Events
  async getEvents(params?: { date?: string; startDate?: string; endDate?: string }): Promise<CalendarEvent[]> {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const data = await this.request<{ events: Array<Record<string, unknown>> }>(`/api/events?${query}`);
    return data.events.map((e) => ({
      id: String(e.id),
      title: String(e.title),
      date: String(e.event_date),
      time: String(e.start_time),
      endTime: e.end_time ? String(e.end_time) : undefined,
      category: (e.category as CalendarEvent['category']) || 'custom',
      categoryLabel: String(e.category_label || 'معاد'),
      location: e.location ? String(e.location) : undefined,
      instructor: e.person ? String(e.person) : undefined,
      course: e.course ? String(e.course) : undefined,
      notes: e.description ? String(e.description) : undefined,
      completed: Boolean(e.completed),
      reminder: Boolean(e.reminder_enabled),
      priority: 'normal',
    }));
  },

  async createEvent(event: Omit<CalendarEvent, 'id' | 'completed'>): Promise<CalendarEvent> {
    const data = await this.request<{ event: Record<string, unknown> }>('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        title: event.title,
        description: event.notes,
        eventDate: event.date,
        startTime: event.time,
        endTime: event.endTime,
        location: event.location,
        person: event.instructor,
        course: event.course,
        category: event.category,
        categoryLabel: event.categoryLabel,
        reminderEnabled: event.reminder,
      }),
    });
    const e = data.event;
    return {
      id: String(e.id),
      title: String(e.title),
      date: String(e.event_date),
      time: String(e.start_time),
      endTime: e.end_time ? String(e.end_time) : undefined,
      category: (e.category as CalendarEvent['category']) || 'custom',
      categoryLabel: String(e.category_label || 'معاد'),
      location: e.location ? String(e.location) : undefined,
      instructor: e.person ? String(e.person) : undefined,
      course: e.course ? String(e.course) : undefined,
      notes: e.description ? String(e.description) : undefined,
      completed: Boolean(e.completed),
      reminder: Boolean(e.reminder_enabled),
      priority: 'normal',
    };
  },

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    await this.request(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: updates.title,
        description: updates.notes,
        eventDate: updates.date,
        startTime: updates.time,
        endTime: updates.endTime,
        location: updates.location,
        person: updates.instructor,
        course: updates.course,
        category: updates.category,
        categoryLabel: updates.categoryLabel,
        completed: updates.completed,
        reminderEnabled: updates.reminder,
      }),
    });
  },

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/api/events/${eventId}`, {
      method: 'DELETE',
    });
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const data = await this.request<{ notifications: Array<Record<string, unknown>> }>('/api/notifications');
    const validTypes: NotificationItem['type'][] = ['upcoming', 'task', 'tomorrow', 'reminder', 'morning', 'evening'];
    return data.notifications.map((n) => {
      const rawType = String(n.type);
      const finalType = validTypes.includes(rawType as NotificationItem['type'])
        ? (rawType as NotificationItem['type'])
        : 'upcoming';

      return {
        id: String(n.id),
        type: finalType,
        title: String(n.title),
        subtitle: String(n.message || ''),
        time: String(n.created_at || 'الآن'),
        read: Boolean(n.read),
        relatedId: n.related_event_id
          ? String(n.related_event_id)
          : n.related_task_id
          ? String(n.related_task_id)
          : undefined,
      };
    });
  },

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllNotificationsRead(): Promise<void> {
    await this.request('/api/notifications/read-all', { method: 'POST' });
  },

  // User Profile & Preferences
  async getMe(): Promise<{ user: Record<string, unknown>; preferences: Record<string, unknown> }> {
    return await this.request('/api/auth/me');
  },

  async updateMe(data: {
    userUpdates?: Record<string, unknown>;
    preferenceUpdates?: Record<string, unknown>;
    displayName?: string;
    timezone?: string;
  }): Promise<{ user: Record<string, unknown>; preferences: Record<string, unknown> }> {
    return await this.request('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getPreferences(): Promise<Record<string, unknown>> {
    const data = await this.request<{ preferences: Record<string, unknown> }>('/api/preferences');
    return data.preferences;
  },

  async updatePreferences(updates: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = await this.request<{ preferences: Record<string, unknown> }>('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return data.preferences;
  },

  // Reminders
  async getReminders(status?: 'pending' | 'fired' | 'dismissed'): Promise<Array<Record<string, unknown>>> {
    const query = status ? `?status=${status}` : '';
    const data = await this.request<{ reminders: Array<Record<string, unknown>> }>(`/api/reminders${query}`);
    return data.reminders;
  },

  async createReminder(reminder: {
    title: string;
    scheduledFor: string;
    type?: 'event' | 'task' | 'custom';
    message?: string;
    taskId?: string;
    eventId?: string;
  }): Promise<Record<string, unknown>> {
    const data = await this.request<{ reminder: Record<string, unknown> }>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    });
    return data.reminder;
  },

  async dismissReminder(id: string): Promise<void> {
    await this.request(`/api/reminders/${id}/dismiss`, { method: 'POST' });
  },

  // Sync Endpoints
  async pushSyncOperations(operations: any[]): Promise<{ success: boolean; processedCount: number; timestamp: string }> {
    return await this.request('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });
  },

  async pullCloudChanges(lastPulledAt?: string): Promise<{ timestamp: string; changes: Record<string, any> }> {
    return await this.request('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ last_pulled_at: lastPulledAt }),
    });
  },

  // Insights
  async getWeeklySummary(date?: string): Promise<Record<string, unknown>> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const data = await this.request<{ summary: Record<string, unknown> }>(`/api/insights/weekly-summary${query}`);
    return data.summary;
  },

  // Device Transfer
  async generateTransferCode(): Promise<{ code: string; expiresInMinutes: number }> {
    return await this.request('/api/sync/transfer/generate', { method: 'POST' });
  },

  async claimTransferCode(code: string): Promise<{ success: boolean; anonymous_user_id: string; installationCredential?: string }> {
    return await this.request('/api/sync/transfer/claim', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
};
