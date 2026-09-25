import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarEvent,
  TaskItem,
  QuickThought,
  NotificationItem,
  TemporalZoomLevel,
  TaskPriority,
} from './types';
import {
  formatDateToISO,
  parseDateString,
  getTodayDateString,
  getRelativeDateString,
} from './utils/dateUtils';
import { sound } from './utils/audio';
import { getZoomTransitionClass } from './utils/motion';

// Components
import { Header } from './components/Header';
import { TemporalLens } from './components/TemporalLens';
import { HeroGreeting } from './components/HeroGreeting';
import { TimeFlow } from './components/TimeFlow';
import { TaskSection } from './components/TaskSection';
import { TomorrowPreview } from './components/TomorrowPreview';
import { QuickAddModal } from './components/QuickAddModal';
import { EventDetailSheet } from './components/EventDetailSheet';
import { NotificationSheet } from './components/NotificationSheet';
import { WeekView } from './components/WeekView';
import { MonthView } from './components/MonthView';
import { OfflineBanner, ErrorStateBanner } from './components/OfflineBanner';
import { TimeFlowSkeleton, WeekSkeleton } from './components/Skeletons';
import { ToastUndo, ToastMessage } from './components/ToastUndo';
import { FirstUseIntro } from './components/FirstUseIntro';
import { Plus, StickyNote, Trash2 } from 'lucide-react';

// IndexedDB Repository, Sync Layer & Reminder Engine
import { indexedDBRepository } from './repositories/indexedDBRepository';
import { syncService } from './services/syncService';
import { apiClient } from './services/apiClient';
import { ReminderEngine } from './services/ReminderEngine';
import { identityService } from './services/identity';

export default function App() {
  const [zoomLevel, setZoomLevel] = useState<TemporalZoomLevel>('day');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const isCloudEnabled = apiClient.isCloudSyncEnabled();

  const [isLoadingView, setIsLoadingView] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('daycompanion_intro_dismissed');
    } catch {
      return true;
    }
  });

  // Race Condition Protection Refs
  const pendingTaskTogglesRef = React.useRef<Set<string>>(new Set());
  const pendingEventTogglesRef = React.useRef<Set<string>>(new Set());

  // Centralized Application State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [thoughts, setThoughts] = useState<QuickThought[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const eventsRef = useRef(events);
  const tasksRef = useRef(tasks);

  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Overlay / Sheet States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [showStorageWarning, setShowStorageWarning] = useState<boolean>(false);

  const todayStr = getTodayDateString();
  const tomorrowStr = getRelativeDateString(1);
  const isToday = selectedDate === todayStr;

  // Initialize Anonymous Installation Identity & Fast Local IndexedDB Data on Mount
  useEffect(() => {
    let listenerHandle: any = null;

    async function initIndexedDBAndSync() {
      // Setup Native Listener
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      listenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (notif) => {
        const entityId = notif.notification.extra?.entityId;
        const entityType = notif.notification.extra?.entityType;
        
        if (entityId) {
            if (entityType === 'task') {
                const task = tasksRef.current.find((t: TaskItem) => t.id === entityId);
                if (task) {
                    setSelectedDate(task.due_date || task.date || todayStr);
                    setZoomLevel('day');
                }
            } else if (entityType === 'event') {
                const event = eventsRef.current.find((e: CalendarEvent) => e.id === entityId);
                if (event) {
                    setSelectedEventForDetail(event);
                    setSelectedDate(event.date);
                    setZoomLevel('day');
                }
            }
        }
      });

      setIsLoadingView(true);
      
      // Request persistent storage if available
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then((persistent) => {
          console.log(persistent ? 'Storage will persist' : 'Storage is not persistent');
        }).catch(() => {});
      }

      try {
        // 1. Initialize IndexedDB & create anonymous installation user
        await indexedDBRepository.initialize();

        // 1b. Capture Daily Snapshot on launch
        const { snapshotService } = await import('./services/snapshotService');
        await snapshotService.captureDailyLaunchSnapshot().catch(() => {});

        // 1c. Storage health check write/read to planner_metadata
        let healthy = true;
        try {
          await indexedDBRepository.setMetadata('health_check_test_key', { tested: true, time: Date.now() });
          const retrieved = await indexedDBRepository.getMetadata<{ tested: boolean }>('health_check_test_key');
          if (!retrieved || !retrieved.tested) {
            healthy = false;
          }
        } catch {
          healthy = false;
        }

        const { isInMemory } = await import('./repositories/dbEngine');
        if (!healthy || isInMemory()) {
          setShowStorageWarning(true);
        }

        // 2. Load immediate fast local data from IndexedDB
        const [localTasks, localEvents, localReminders, localNotifs, localPrefs] = await Promise.all([
            indexedDBRepository.getAllTasks(),
            indexedDBRepository.getAllEvents(),
            indexedDBRepository.getAllReminders(),
            indexedDBRepository.getAllNotifications(),
            indexedDBRepository.getPreferences()
        ]);

        setTasks(localTasks);
        setEvents(localEvents);
        setThoughts(localReminders);
        setNotifications(localNotifs);

        if (localPrefs) {
          if (localPrefs.defaultView) setZoomLevel(localPrefs.defaultView);
          if (localPrefs.reminderPreferences && localPrefs.reminderPreferences.sound !== undefined) {
            setSoundEnabled(localPrefs.reminderPreferences.sound);
            sound.enabled = localPrefs.reminderPreferences.sound;
          }
        }
      } catch (err) {
        console.warn('IndexedDB Local Load Warning:', err);
        setShowStorageWarning(true);
      } finally {
        setIsLoadingView(false);
      }

      // 3. Background Sync with Express / Turso Cloud API
      if (isCloudEnabled) {
        try {
          await identityService.ensureInstallationCredential();
          const synced = await syncService.fullSync();
          if (synced) {
            setTasks(synced.tasks);
            setEvents(synced.events);
            setThoughts(synced.reminders);
            setNotifications(synced.notifications);
          }
        } catch {
          // Continue seamlessly in local-first mode
        }
      }

      // 4. Start Local-First Reminder Engine Ticker
      ReminderEngine.startTicker((newNotif) => {
        setNotifications((prev) => [newNotif, ...prev]);
      });
    }

    initIndexedDBAndSync();

    return () => {
      ReminderEngine.stopTicker();
      if (listenerHandle) {
          listenerHandle.remove();
      }
    };
  }, []);

  // Listen to browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (isCloudEnabled) syncService.flushSyncQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isCloudEnabled]);

  // Native Android back button interception using Capacitor App plugin
  useEffect(() => {
    let activeListener: any = null;
    
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', (data) => {
        if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
        } else if (isNotificationsOpen) {
          setIsNotificationsOpen(false);
        } else if (selectedEventForDetail) {
          setSelectedEventForDetail(null);
        } else {
          // If no modal or sheet is open, let the app minimize naturally
          App.minimizeApp();
        }
      }).then(listener => {
        activeListener = listener;
      });
    }).catch(() => {
      // Ignore if not running on native mobile shell
    });

    return () => {
      if (activeListener) {
        activeListener.remove();
      }
    };
  }, [isQuickAddOpen, isNotificationsOpen, selectedEventForDetail]);

  const handleDismissIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem('daycompanion_intro_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  // Memoized Filtered events & tasks for active selected day
  const currentDayEvents = useMemo(() => events.filter((e) => e.date === selectedDate), [events, selectedDate]);
  const currentDayTasks = useMemo(() => {
    if (isToday) {
        return tasks.filter((t) => (t.date === selectedDate || !t.date));
    }
    return tasks.filter((t) => t.date === selectedDate);
  }, [tasks, selectedDate, isToday]);

  const overdueTasks = useMemo(() => {
      if (!isToday) return [];
      return tasks.filter(t => t.date && t.date < selectedDate && !t.completed);
  }, [tasks, selectedDate, isToday]);
  const tomorrowEvents = useMemo(() => events.filter((e) => e.date === tomorrowStr), [events, tomorrowStr]);
  const tomorrowTasks = useMemo(() => tasks.filter((t) => t.date === tomorrowStr), [tasks, tomorrowStr]);

  const unreadNotifsCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const current = parseDateString(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(formatDateToISO(current));
  };

  const handleNextDay = () => {
    const current = parseDateString(selectedDate);
    current.setDate(current.getDate() + 1);
    setSelectedDate(formatDateToISO(current));
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayStr);
    setZoomLevel('day');
  };

  const handleGoToTomorrow = () => {
    setSelectedDate(tomorrowStr);
    setZoomLevel('day');
  };

  const handleZoomChange = async (newLevel: TemporalZoomLevel) => {
    if (newLevel !== zoomLevel) {
      setZoomLevel(newLevel);
      const currentPrefs = await indexedDBRepository.getPreferences();
      const updatedPrefs = { ...currentPrefs, defaultView: newLevel };
      await indexedDBRepository.savePreferences(updatedPrefs);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'preference',
        action: 'update',
        entityId: 'default',
        payload: { default_view: newLevel },
      });
      syncService.flushSyncQueue();
    }
  };

  // Sound Toggle Handler
  const handleToggleSound = async () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    sound.enabled = nextVal;

    const currentPrefs = await indexedDBRepository.getPreferences();
    const updatedPrefs = {
      ...currentPrefs,
      reminderPreferences: { ...currentPrefs.reminderPreferences, sound: nextVal },
    };
    await indexedDBRepository.savePreferences(updatedPrefs);

    await indexedDBRepository.enqueueSyncOp({
      entityType: 'preference',
      action: 'update',
      entityId: 'default',
      payload: { reminder_preferences: JSON.stringify({ sound: nextVal, lead_time_minutes: 15 }) },
    });
    syncService.flushSyncQueue();
  };

  const addToast = (
    message: string,
    type: 'success' | 'undo' | 'info' | 'error' = 'success',
    undoAction?: () => void,
    undoLabel?: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newToast: ToastMessage = { id, type, message, undoAction, undoLabel };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Event Action Handlers (Offline-First IndexedDB + Background Sync)
  const handleToggleEventComplete = async (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (pendingEventTogglesRef.current.has(eventId)) return;
    pendingEventTogglesRef.current.add(eventId);

    const target = events.find((evt) => evt.id === eventId);
    if (!target) {
      pendingEventTogglesRef.current.delete(eventId);
      return;
    }
    const nextCompleted = !target.completed;
    const updatedEvent: CalendarEvent = { ...target, completed: nextCompleted };

    // 1. Immediate UI update
    setEvents((prev) =>
      prev.map((evt) => (evt.id === eventId ? updatedEvent : evt))
    );
    if (selectedEventForDetail && selectedEventForDetail.id === eventId) {
      setSelectedEventForDetail(updatedEvent);
    }

    // 2. Immediate local persistence to IndexedDB
    await indexedDBRepository.saveEvent(updatedEvent);

    // 3. Queue cloud sync
    await indexedDBRepository.enqueueSyncOp({
      entityType: 'event',
      action: 'update',
      entityId: eventId,
      payload: { completed: nextCompleted },
    });

    syncService.flushSyncQueue();
    pendingEventTogglesRef.current.delete(eventId);
  };

  const handleToggleEventReminder = async (eventId: string) => {
    const target = events.find((evt) => evt.id === eventId);
    if (!target) return;
    const nextReminder = !target.reminder;
    const updatedEvent = { ...target, reminder: nextReminder };

    setEvents((prev) =>
      prev.map((evt) => (evt.id === eventId ? updatedEvent : evt))
    );
    if (selectedEventForDetail && selectedEventForDetail.id === eventId) {
      setSelectedEventForDetail(updatedEvent);
    }

    await indexedDBRepository.saveEvent(updatedEvent);

    await indexedDBRepository.enqueueSyncOp({
      entityType: 'event',
      action: 'update',
      entityId: eventId,
      payload: { reminder: nextReminder },
    });
    syncService.flushSyncQueue();
  };

  const handleDeleteEvent = async (eventId: string) => {
    const deletedEvent = events.find((e) => e.id === eventId);
    if (!deletedEvent) return;

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (selectedEventForDetail?.id === eventId) {
      setSelectedEventForDetail(null);
    }

    await indexedDBRepository.deleteEvent(eventId);

    await indexedDBRepository.enqueueSyncOp({
      entityType: 'event',
      action: 'delete',
      entityId: eventId,
      payload: {},
    });

    syncService.flushSyncQueue();

    addToast(
      'اتحذف المعاد.',
      'undo',
      async () => {
        setEvents((prev) => [...prev, deletedEvent]);
        await indexedDBRepository.saveEvent(deletedEvent);
        await indexedDBRepository.enqueueSyncOp({
          entityType: 'event',
          action: 'create',
          entityId: deletedEvent.id,
          payload: deletedEvent as any,
        });
        syncService.flushSyncQueue();
      },
      'تراجع'
    );
  };

  const handleUpdateEvent = async (updatedEvent: CalendarEvent) => {
    const previous = events.find((e) => e.id === updatedEvent.id);
    if (!previous) return;

    setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
    setSelectedEventForDetail(updatedEvent);

    try {
      await indexedDBRepository.saveEvent(updatedEvent);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'event',
        action: 'update',
        entityId: updatedEvent.id,
        payload: updatedEvent as any,
      });

      syncService.flushSyncQueue();
      addToast('اتحفظت التعديلات 👌', 'success');
    } catch {
      setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? previous : e)));
      setSelectedEventForDetail(previous);
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
    }
  };

  const handleMoveEventToDate = async (eventId: string, newDateStr: string) => {
    const previous = events.find((e) => e.id === eventId);
    if (!previous) return;
    const movedEvent = { ...previous, date: newDateStr, completed: false };

    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? movedEvent : e))
    );

    try {
      await indexedDBRepository.saveEvent(movedEvent);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'event',
        action: 'update',
        entityId: eventId,
        payload: { date: newDateStr, completed: false },
      });

      syncService.flushSyncQueue();
      addToast('اترحل المعاد لليوم التاني 👌', 'success');
    } catch {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? previous : e)));
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
    }
  };

  const handleAddEvent = async (newEventData: Omit<CalendarEvent, 'id' | 'completed'>) => {
    const rawDate = newEventData.date;
    const targetDate = (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate))
      ? rawDate
      : (selectedDate || getTodayDateString());

    const newEvent: CalendarEvent = {
      ...newEventData,
      date: targetDate,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      completed: false,
    };

    setEvents((prev) => [...prev, newEvent]);

    try {
      await indexedDBRepository.saveEvent(newEvent);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'event',
        action: 'create',
        entityId: newEvent.id,
        payload: newEvent as any,
      });

      syncService.flushSyncQueue();
      ReminderEngine.checkAndFireReminders().catch(() => {});
      addToast('اتسجل المعاد بنجاح 👌', 'success');
      return true;
    } catch {
      setEvents((prev) => prev.filter((e) => e.id !== newEvent.id));
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
      return false;
    }
  };

  // Task Action Handlers (Offline-First IndexedDB + Sync)
  const handleToggleTask = async (taskId: string) => {
    if (pendingTaskTogglesRef.current.has(taskId)) return;
    pendingTaskTogglesRef.current.add(taskId);

    const target = tasks.find((t) => t.id === taskId);
    if (!target) {
      pendingTaskTogglesRef.current.delete(taskId);
      return;
    }
    const nextCompleted = !target.completed;
    const updatedTask = { ...target, completed: nextCompleted };

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? updatedTask : t))
    );

    try {
      await indexedDBRepository.saveTask(updatedTask);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'task',
        action: 'update',
        entityId: taskId,
        payload: { completed: nextCompleted },
      });

      syncService.flushSyncQueue();
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? target : t))
      );
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
    } finally {
      pendingTaskTogglesRef.current.delete(taskId);
    }
  };

  const handleAddTask = async (taskInput: Partial<TaskItem> & { title: string } | any) => {
    // If called via raw UI with simple arguments, normalize it
    const title = typeof taskInput === 'string' ? taskInput : taskInput.title;
    const priority = (typeof taskInput === 'object' && taskInput.priority) || 'normal';
    const category = (typeof taskInput === 'object' && taskInput.category) || 'عام';
    const notes = (typeof taskInput === 'object' && (taskInput.notes || taskInput.description)) || '';
    
    const rawDate = typeof taskInput === 'object' ? (taskInput.date || taskInput.due_date) : undefined;
    const targetDate = (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate))
      ? rawDate
      : (selectedDate || getTodayDateString());

    const due_time = (typeof taskInput === 'object' && taskInput.due_time) || '';
    const reminder = typeof taskInput === 'object' ? Boolean(taskInput.reminder) : false;

    const newTask: TaskItem = {
      id: `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      completed: false,
      date: targetDate,
      due_date: targetDate,
      due_time,
      priority,
      category,
      notes,
      description: notes,
      reminder,
    };

    setTasks((prev) => [newTask, ...prev]);

    try {
      await indexedDBRepository.saveTask(newTask);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'task',
        action: 'create',
        entityId: newTask.id,
        payload: { 
          title, 
          notes, 
          description: notes, 
          date: targetDate, 
          due_date: targetDate, 
          due_time, 
          priority, 
          category, 
          reminder 
        },
      });

      syncService.flushSyncQueue();
      ReminderEngine.checkAndFireReminders().catch(() => {});
      addToast('اتسجلت المهمة بنجاح 👌', 'success');
      return true;
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== newTask.id));
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
      return false;
    }
  };

  const handleUpdateTask = async (taskId: string, newTitle: string) => {
    const previous = tasks.find((t) => t.id === taskId);
    if (!previous) return;
    const updatedTask = { ...previous, title: newTitle };

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? updatedTask : t))
    );

    try {
      await indexedDBRepository.saveTask(updatedTask);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'task',
        action: 'update',
        entityId: taskId,
        payload: { title: newTitle },
      });

      syncService.flushSyncQueue();
      addToast('اتحفظت المهمة 👌', 'success');
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? previous : t))
      );
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const deletedTask = tasks.find((t) => t.id === taskId);
    if (!deletedTask) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await indexedDBRepository.deleteTask(taskId);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'task',
        action: 'delete',
        entityId: taskId,
        payload: {},
      });

      syncService.flushSyncQueue();

      addToast(
        'اتحذفت المهمة.',
        'undo',
        async () => {
          setTasks((prev) => [deletedTask, ...prev]);
          try {
            await indexedDBRepository.saveTask(deletedTask);
            await indexedDBRepository.enqueueSyncOp({
              entityType: 'task',
              action: 'create',
              entityId: deletedTask.id,
              payload: {
                title: deletedTask.title,
                notes: deletedTask.notes,
                date: deletedTask.date,
                priority: deletedTask.priority,
                category: deletedTask.category,
              },
            });
            syncService.flushSyncQueue();
          } catch {
            addToast('مقدرناش نرجع المهمة ❌', 'error');
          }
        },
        'تراجع'
      );
    } catch {
      setTasks((prev) => [deletedTask, ...prev]);
      addToast('مقدرناش نحذف المهمة، جرّب تاني ❌', 'error');
    }
  };

  // Thought Action Handlers
  const handleAddThought = async (thoughtData: Omit<QuickThought, 'id'>) => {
    const newThought: QuickThought = {
      ...thoughtData,
      id: `th_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setThoughts((prev) => [newThought, ...prev]);

    try {
      await indexedDBRepository.saveReminder(newThought);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'reminder',
        action: 'create',
        entityId: newThought.id,
        payload: {
          id: newThought.id,
          title: newThought.title || newThought.text || '',
          text: newThought.text || newThought.title || '',
          scheduled_for: newThought.scheduled_for,
          date: newThought.date,
          status: newThought.status || 'pending',
          type: newThought.type || 'custom',
          pinned: Boolean(newThought.pinned),
          trigger_configuration: newThought,
        },
      });

      syncService.flushSyncQueue();
      addToast('اتسجلت الملاحظة 👌', 'success');
    } catch {
      setThoughts((prev) => prev.filter((t) => t.id !== newThought.id));
      addToast('مقدرناش نحفظ، جرّب تاني ❌', 'error');
    }
  };

  const handleDeleteThought = async (thoughtId: string) => {
    const deletedThought = thoughts.find((t) => t.id === thoughtId);
    if (!deletedThought) return;

    setThoughts((prev) => prev.filter((t) => t.id !== thoughtId));

    try {
      await indexedDBRepository.deleteReminder(thoughtId);

      await indexedDBRepository.enqueueSyncOp({
        entityType: 'reminder',
        action: 'delete',
        entityId: thoughtId,
        payload: {},
      });

      syncService.flushSyncQueue();

      addToast(
        'اتحذفت الخاطرة.',
        'undo',
        async () => {
          setThoughts((prev) => [deletedThought, ...prev]);
          try {
            await indexedDBRepository.saveReminder(deletedThought);
            await indexedDBRepository.enqueueSyncOp({
              entityType: 'reminder',
              action: 'create',
              entityId: deletedThought.id,
              payload: {
                id: deletedThought.id,
                title: deletedThought.title || deletedThought.text || '',
                text: deletedThought.text || deletedThought.title || '',
                scheduled_for: deletedThought.scheduled_for,
                date: deletedThought.date,
                status: deletedThought.status || 'pending',
                type: deletedThought.type || 'custom',
                pinned: Boolean(deletedThought.pinned),
                trigger_configuration: deletedThought,
              },
            });
            syncService.flushSyncQueue();
          } catch {
            addToast('مقدرناش نرجع الخاطرة ❌', 'error');
          }
        },
        'تراجع'
      );
    } catch {
      setThoughts((prev) => [deletedThought, ...prev]);
      addToast('مقدرناش نحذف الخاطرة، جرّب تاني ❌', 'error');
    }
  };

  // Notification Handlers
  const handleNotificationClick = async (notif: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setIsNotificationsOpen(false);

    await indexedDBRepository.markNotificationRead(notif.id);

    await indexedDBRepository.enqueueSyncOp({
      entityType: 'notification',
      action: 'update',
      entityId: notif.id,
      payload: { read: true },
    });
    syncService.flushSyncQueue();

    if (notif.type === 'tomorrow') {
      setSelectedDate(tomorrowStr);
      setZoomLevel('day');
    } else if (notif.relatedId) {
      const relatedEvent = events.find((e) => e.id === notif.relatedId);
      if (relatedEvent) {
        setSelectedDate(relatedEvent.date);
        setZoomLevel('day');
        setSelectedEventForDetail(relatedEvent);
      }
    }
  };

  const handleMarkAllNotifsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await indexedDBRepository.markAllNotificationsRead();
    apiClient.markAllNotificationsRead().catch(() => {});
    addToast('اتقرت كل الإشعارات ✨', 'info');
  };

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#242522] flex flex-col font-sans antialiased pb-28">
      {/* Top Application Header */}
      <Header
        unreadNotifsCount={unreadNotifsCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        isToday={isToday}
        onJumpToToday={handleJumpToToday}
      />

      {/* Temporal Lens Zoom Controller (اليوم / الأسبوع / الشهر) */}
      <TemporalLens currentLevel={zoomLevel} onChange={handleZoomChange} />

      {/* Main Single Continuous Temporal Canvas */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6">
        {hasError && (
          <ErrorStateBanner
            message="حصلت مشكلة في الاتصال بالخادم."
            onRetry={() => {
              sound.playTap();
              syncService.fullSync();
            }}
          />
        )}

        {showIntro && (
          <FirstUseIntro
            onDismiss={handleDismissIntro}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          />
        )}

        {isLoadingView ? (
          zoomLevel === 'week' ? <WeekSkeleton /> : <TimeFlowSkeleton />
        ) : (
          <div className={getZoomTransitionClass(zoomLevel)}>
            {zoomLevel === 'day' && (
              <div>
                {/* Hero Greeting & Smart Context */}
                <HeroGreeting
                  currentDateStr={selectedDate}
                  onPrevDay={handlePrevDay}
                  onNextDay={handleNextDay}
                  events={currentDayEvents}
                  tasks={currentDayTasks}
                  tomorrowEvents={tomorrowEvents}
                  tomorrowTasks={tomorrowTasks}
                  onSelectNextEvent={(evt) => setSelectedEventForDetail(evt)}
                />

                {/* Adaptive Layout: Side-by-side contextual arrangement on desktop (lg+), clean single vertical flow on mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
                  {/* Primary Story Rail (TimeFlow) */}
                  <div className="lg:col-span-7 xl:col-span-7">
                    <TimeFlow
                      events={currentDayEvents}
                      selectedDate={selectedDate}
                      isToday={isToday}
                      onSelectEvent={(event) => setSelectedEventForDetail(event)}
                      onToggleEventComplete={handleToggleEventComplete}
                      onQuickAddEvent={() => setIsQuickAddOpen(true)}
                    />
                  </div>

                  {/* Contextual Complement Column (Tasks + Thoughts + Tomorrow Preview) */}
                  <div className="lg:col-span-5 xl:col-span-5 space-y-4">
                    {/* Tasks Section ("لسه وراك") */}
                    <TaskSection
                      tasks={currentDayTasks}
                      overdueTasks={overdueTasks}
                      selectedDate={selectedDate}
                      onToggleTask={handleToggleTask}
                      onAddTask={handleAddTask}
                      onDeleteTask={handleDeleteTask}
                      onUpdateTask={handleUpdateTask}
                    />

                    {/* Quick Thoughts & Notes */}
                    {thoughts.length > 0 && (
                      <section className="px-3 sm:px-4 max-w-3xl mx-auto">
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <StickyNote className="w-4 h-4 text-[#C58B5C]" />
                          <h3 className="text-sm font-bold text-[#243B35]">
                            خواطر وملاحظات سريعة
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {thoughts.map((th) => (
                            <div
                              key={th.id}
                              className="bg-white/90 border border-[#E4DED4] p-3.5 rounded-2xl text-xs text-[#242522] shadow-xs flex justify-between items-center gap-3"
                            >
                              <p className="leading-relaxed flex-1 text-right">{th.text}</p>
                              <button
                                onClick={() => handleDeleteThought(th.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50/50 transition-colors shrink-0 cursor-pointer"
                                aria-label="حذف الخاطرة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Tomorrow Preview ("بكرة 👀") */}
                    <TomorrowPreview
                      tomorrowEventsCount={tomorrowEvents.length}
                      tomorrowTasksCount={tomorrowTasks.length}
                      onGoToTomorrow={handleGoToTomorrow}
                      isToday={isToday}
                    />
                  </div>
                </div>
              </div>
            )}

            {zoomLevel === 'week' && (
              <WeekView
                currentDateStr={selectedDate}
                events={events}
                tasks={tasks}
                onSelectDay={(dateStr) => {
                  setSelectedDate(dateStr);
                  setZoomLevel('day');
                }}
                onChangeDate={(dateStr) => {
                  setSelectedDate(dateStr);
                }}
              />
            )}

            {zoomLevel === 'month' && (
              <MonthView
                currentDateStr={selectedDate}
                events={events}
                tasks={tasks}
                onSelectDate={(dateStr) => {
                  setSelectedDate(dateStr);
                  setZoomLevel('day');
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button: "+ وراك إيه؟" */}
      <div className="fixed bottom-6 right-6 sm:right-8 z-40">
        <button
          onClick={() => {
            sound.playPop();
            setIsQuickAddOpen(true);
          }}
          className="flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[#243B35] text-[#F6F3EE] font-bold text-sm sm:text-base shadow-xl shadow-[#243B35]/25 hover:bg-[#1b2d28] hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-[#D8C3A5]/40"
          aria-label="إضافة معاد أو مهمة جديدة"
        >
          <Plus className="w-5 h-5 text-[#D8C3A5]" />
          <span>+ وراك إيه؟</span>
        </button>
      </div>

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <QuickAddModal
          key={`${selectedDate}_open`}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          selectedDate={selectedDate}
          onAddEvent={handleAddEvent}
          onAddTask={handleAddTask}
          onAddThought={handleAddThought}
        />
      )}

      {/* Event Details Sheet with Rescheduling & Editing */}
      <EventDetailSheet
        event={selectedEventForDetail}
        onClose={() => setSelectedEventForDetail(null)}
        onToggleComplete={handleToggleEventComplete}
        onToggleReminder={handleToggleEventReminder}
        onDeleteEvent={handleDeleteEvent}
        onUpdateEvent={handleUpdateEvent}
        onMoveToDate={handleMoveEventToDate}
      />

      {/* Contextual Notification Sheet */}
      <NotificationSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAllRead={handleMarkAllNotifsRead}
      />

      {/* Undo & Action Toast Notifications */}
      <ToastUndo toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
