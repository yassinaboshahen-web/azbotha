# API Contract Documentation — "Day Companion / صاحب يومك"

Production-grade REST & Sync API endpoints matching frontend contract 100%.

## Authentication & Headers
All requests must include:
- `X-Anonymous-User-Id`: Secure installation identity string (alphanumeric/dash/underscore, <= 128 chars).
- `Authorization`: `Bearer <installation_token>`.

---

## 1. Authentication & Device Identity (`/api/auth`)
- `POST /api/auth/register` (Public)
  - Registers a new anonymous device installation token.
  - Rate limited: 10 req/hr per IP.
  - Response: `{ success: true, anonymousUserId: string, installationCredential: string, needsInitialUpload: true }`
- `GET /api/auth/me` (Protected)
  - Retrieves current user record and user preferences.
  - Response: `{ user: UserRecord, preferences: UserPreferences }`
- `PATCH /api/auth/me` (Protected)
  - Updates profile fields or preferences.
  - Response: `{ user: UserRecord, preferences: UserPreferences }`

---

## 2. Tasks (`/api/tasks`)
- `GET /api/tasks` (Protected)
  - Query params: `date?` (YYYY-MM-DD), `completed?` (boolean).
  - Response: `{ tasks: TaskItem[] }`
- `POST /api/tasks` (Protected)
  - Body: `{ title: string, description?: string, notes?: string, dueDate?: string, date?: string, dueTime?: string, priority?: string, category?: string, reminder?: boolean }`
  - Response: `{ task: TaskItem }` (201 Created)
- `PATCH /api/tasks/:id` (Protected)
  - Body: Partial task fields to update.
  - Response: `{ task: TaskItem }`
- `PATCH /api/tasks/:id/complete` (Protected)
  - Body: `{ completed: boolean }`
  - Response: `{ success: true, id: string, completed: boolean, status: string }`
- `DELETE /api/tasks/:id` (Protected)
  - Soft-deletes task (`deleted_at = now()`).
  - Response: `{ success: true, message: string }`

---

## 3. Events (`/api/events`)
- `GET /api/events` (Protected)
  - Query params: `date?` (YYYY-MM-DD), `startDate?`, `endDate?`.
  - Response: `{ events: CalendarEvent[] }`
- `POST /api/events` (Protected)
  - Body: `{ title: string, eventDate: string, startTime?: string, endTime?: string, location?: string, person?: string, doctor_or_ta?: string, course?: string, notes?: string, category?: string, categoryLabel?: string, reminderEnabled?: boolean }`
  - Response: `{ event: CalendarEvent }` (201 Created)
- `PATCH /api/events/:id` (Protected)
  - Body: Partial event fields to update.
  - Response: `{ event: CalendarEvent }`
- `DELETE /api/events/:id` (Protected)
  - Soft-deletes event (`deleted_at = now()`).
  - Response: `{ success: true, message: string }`

---

## 4. Notifications (`/api/notifications`)
- `GET /api/notifications` (Protected)
  - Response: `{ notifications: NotificationItem[] }`
- `PATCH /api/notifications/:id/read` (Protected)
  - Response: `{ success: true, id: string, read: true }`
- `POST /api/notifications/read-all` (Protected)
  - Response: `{ success: true, message: string }`

---

## 5. User Preferences (`/api/preferences`)
- `GET /api/preferences` (Protected)
  - Response: `{ preferences: UserPreferences }`
- `PUT /api/preferences` (Protected)
  - Body: `{ timezone?: string, locale?: string, week_start_day?: string, notification_preferences?: object }`
  - Response: `{ preferences: UserPreferences }`

---

## 6. Reminders (`/api/reminders`)
- `GET /api/reminders` (Protected)
  - Query params: `status?` ('pending' | 'fired' | 'dismissed').
  - Response: `{ reminders: QuickThought[] }`
- `POST /api/reminders` (Protected)
  - Body: `{ title: string, scheduledFor: string, type?: string, message?: string, taskId?: string, eventId?: string }`
  - Response: `{ reminder: QuickThought }` (201 Created)
- `POST /api/reminders/:id/dismiss` (Protected)
  - Response: `{ success: true, message: string }`

---

## 7. Cloud Synchronization (`/api/sync`)
- `POST /api/sync/push` (Protected)
  - Pushes batch offline operations (max 100).
  - Body: `{ operations: SyncOperation[] }`
  - Response: `{ success: true, processedCount: number, timestamp: string }`
- `POST /api/sync/pull` (Protected)
  - Pulls cloud state for user including tombstoned deleted records.
  - Response: `{ timestamp: string, changes: { tasks, events, reminders, notifications, preferences } }`

---

## 8. Account Transfer (`/api/sync/transfer`)
- `POST /api/sync/transfer/generate` (Protected)
  - Generates an 8-digit temporary transfer code (valid 15 mins).
  - Response: `{ success: true, code: string, expiresInMinutes: 15 }`
- `POST /api/sync/transfer/claim` (Public, Rate-limited: 5/min, 20/hr)
  - Claims transfer code to link identity to new device.
  - Body: `{ code: string }`
  - Response: `{ success: true, anonymous_user_id: string, installationCredential: string }`

---

## 9. Factual Insights (`/api/insights`)
- `GET /api/insights/weekly-summary` (Protected)
  - Query params: `date?` (YYYY-MM-DD).
  - Response: `{ summary: WeeklyFactualInsights }`

---

## Standard Error Response Format
All errors return consistent structure without internal stack traces:
```json
{
  "error": "ErrorType",
  "message": "User-friendly description in Arabic"
}
```
HTTP Status Codes: 400 (Validation), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 429 (Rate Limit), 500 (Server Error).
