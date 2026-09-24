export type TemporalZoomLevel = 'day' | 'week' | 'month';

export type EventCategory =
  | 'lecture'
  | 'section'
  | 'meeting'
  | 'workout'
  | 'personal'
  | 'study'
  | 'custom';

// Canonical Priority & Status Union Types
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | 'normal' | 'light';
export type TaskStatus = 'pending' | 'completed' | 'archived';
export type EventStatus = 'upcoming' | 'completed' | 'cancelled' | 'confirmed' | 'tentative';
export type ReminderType = 'relative' | 'date_based' | 'event' | 'task' | 'custom';
export type SyncOperationType = 'create' | 'update' | 'delete';

export type SyncEntityType = 'task' | 'event' | 'reminder' | 'notification' | 'user_preferences';
export type SyncOperationKind = 'create' | 'update' | 'delete';
export type SyncOperationStatus = 'pending' | 'processing' | 'synced' | 'failed';

// Anonymous User Identity Model
export interface AnonymousUser {
  id: string; // Cryptographically secure random anonymous ID (e.g. anon_usr_...)
  createdAt: string;
  lastActiveAt: string;
  isAnonymous: true;
}

// Canonical Task Domain Model
export interface TaskRecord {
  id: string;
  anonymous_user_id?: string;
  title: string;
  description?: string;
  due_date?: string; // YYYY-MM-DD
  due_time?: string; // HH:MM
  priority: TaskPriority;
  status?: TaskStatus;
  completed: boolean;
  completed_at?: string; // ISO timestamp
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  category?: string;
  reminder?: boolean;
  notes?: string;
  date?: string; // Compatibility alias for due_date
}

export type TaskItem = TaskRecord;
export type Task = TaskRecord;

// Canonical Event Domain Model
export interface EventRecord {
  id: string;
  anonymous_user_id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // "HH:MM" 24-hr format
  start_time?: string; // HH:MM
  end_time?: string; // HH:MM
  endTime?: string; // HH:MM alias for end_time
  location?: string;
  doctor_or_ta?: string; // Doctor / TA / Person
  instructor?: string; // Compatibility alias
  course?: string;
  notes?: string;
  category?: EventCategory;
  categoryLabel?: string;
  reminder?: boolean;
  status?: EventStatus;
  completed: boolean;
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  priority?: TaskPriority;
}

export type CalendarEvent = EventRecord;
export type Event = EventRecord;

// Canonical Reminder / Quick Thought Domain Model
export interface ReminderRecord {
  id: string;
  anonymous_user_id?: string;
  title?: string;
  text?: string; // Quick thought text
  scheduled_for?: string;
  date?: string;
  status?: 'pending' | 'fired' | 'dismissed';
  type?: ReminderType;
  pinned?: boolean;
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type QuickThought = ReminderRecord;
export type Reminder = ReminderRecord;

// Canonical Notification Domain Model
export type NotificationType = 'upcoming' | 'task' | 'tomorrow' | 'reminder' | 'morning' | 'evening' | 'general';

export interface NotificationRecord {
  id: string;
  anonymous_user_id?: string;
  title: string;
  subtitle: string;
  time: string;
  type: NotificationType;
  relatedId?: string;
  read: boolean;
  actionText?: string;
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type NotificationItem = NotificationRecord;
export type Notification = NotificationRecord;
export type SmartNotification = NotificationRecord;

// Canonical User Preferences Domain Model
export interface UserPreferencesRecord {
  id: string; // 'default' or user_id
  anonymous_user_id?: string;
  timezone: string;
  locale: string;
  week_starts_on?: 'saturday' | 'sunday' | 'monday';
  weekStartsOn?: 'saturday' | 'sunday' | 'monday';
  default_view?: TemporalZoomLevel;
  defaultView?: TemporalZoomLevel;
  reminder_preferences?: {
    sound: boolean;
    lead_time_minutes: number;
  };
  reminderPreferences?: {
    sound: boolean;
    leadTimeMinutes: number;
  };
  notification_preferences?: {
    in_app: boolean;
    push: boolean;
  };
  notificationPreferences?: {
    inApp: boolean;
    push: boolean;
  };
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

export type UserPreferences = UserPreferencesRecord;

// Canonical Planner Metadata Domain Model
export interface PlannerMetadataRecord {
  key: string;
  value: unknown;
  updated_at: string; // ISO timestamp
}

export type PlannerMetadata = PlannerMetadataRecord;

// Canonical Offline-First Sync Operation Model
export interface SyncOperation {
  id: string;
  anonymous_user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation_type: SyncOperationKind;
  payload: Record<string, unknown>;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  retry_count: number;
  last_attempt_at?: string; // ISO timestamp
  status: SyncOperationStatus;
  error?: string;
  // Compatibility aliases:
  action?: SyncOperationKind;
  timestamp?: string;
}

export type SyncOperationRecord = SyncOperation;

export interface WeeklyInsightSummary {
  totalEvents: number;
  totalTasks: number;
  completedTasks: number;
  completedEvents: number;
  busiestDayName: string;
  busiestDayCount: number;
  unfinishedItemsCount: number;
  contextualTone: string;
}
