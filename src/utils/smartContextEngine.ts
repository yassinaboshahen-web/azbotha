import { CalendarEvent, TaskItem } from '../types';
import { getCurrentTimeMinutes, timeStringToMinutes, formatDateToISO } from './dateUtils';

export interface SmartContextResult {
  moodKey: 'calm' | 'busy' | 'very-busy' | 'all-done' | 'empty' | 'upcoming-soon' | 'evening-winddown';
  greeting: string;
  headline: string;
  subtext: string;
  badge?: string;
  nextEvent?: CalendarEvent;
  minutesUntilNext?: number;
  highlightCategory?: string;
}

/**
 * Deterministic Context Engine with natural Egyptian Arabic copy variants
 */
export function evaluateSmartDayContext(params: {
  dateStr: string;
  events: CalendarEvent[];
  tasks: TaskItem[];
  tomorrowEvents: CalendarEvent[];
  tomorrowTasks: TaskItem[];
}): SmartContextResult {
  const { dateStr, events, tasks, tomorrowEvents, tomorrowTasks } = params;
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = formatDateToISO(now);
  const isToday = dateStr === todayStr;

  // Time-based greetings
  let greeting = 'صباح الفل يا غالي ☕️';
  if (currentHour >= 12 && currentHour < 17) {
    greeting = 'مساء الخير ☀️';
  } else if (currentHour >= 17 && currentHour < 23) {
    greeting = 'مساء النور والروقان 🌙';
  } else if (currentHour >= 23 || currentHour < 5) {
    greeting = 'يا سهران في نص الليل ✨';
  }

  const completedEvents = events.filter((e) => e.completed);
  const pendingEvents = events.filter((e) => !e.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);
  const totalItems = events.length + tasks.length;
  const totalCompleted = completedEvents.length + completedTasks.length;

  // 1. Completely Empty Day
  if (totalItems === 0) {
    if (isToday) {
      return {
        moodKey: 'empty',
        greeting: 'عامل إيه؟ 👋 يلا نشوف وراك إيه النهارده.',
        headline: 'يومك لسه فاضي.',
        subtext: 'ضيف أول حاجة وراك وخلي "صاحب يومك" يرتبلك سريان الوقت خطوة بخطوة 🍃',
        badge: 'يوم رايق',
      };
    } else {
      return {
        moodKey: 'empty',
        greeting,
        headline: 'اليوم ده لسه فاضي ومفيهوش مواعيد 🍃',
        subtext: 'تقدر ترتب فيه اللي تحبه من بدري وتضيف أول حاجة وراك.',
        badge: 'فاضي',
      };
    }
  }

  // 2. All Tasks & Events Completed
  if (totalCompleted === totalItems && totalItems > 0) {
    const allDoneHeadlines = [
      'كده خلصنا كل حاجة 😌',
      'عاش والله! قفلت كل اللي وراك النهارده 🎉',
      'يومك ماشي على مسطرة.. ارتاح بقى ☕️',
    ];
    const headline = allDoneHeadlines[Math.floor((events.length + tasks.length) % allDoneHeadlines.length)];

    let subtext = 'كل المواعيد والمهام خلصت، تقدر تروق على نفسك.';
    if (tomorrowEvents.length > 0 || tomorrowTasks.length > 0) {
      subtext = `خلصنا النهارده، وبكرة عندك ${tomorrowEvents.length + tomorrowTasks.length} حاجات مجهزة.`;
    }

    return {
      moodKey: 'all-done',
      greeting,
      headline,
      subtext,
      badge: 'تم الإنجاز كامل ✓',
    };
  }

  // 3. Find Next Upcoming Event for Today
  let nextEvent: CalendarEvent | undefined;
  let minutesUntilNext: number | undefined;

  if (isToday) {
    const currentMin = getCurrentTimeMinutes();
    const futureEvents = events
      .filter((e) => !e.completed)
      .map((e) => ({
        event: e,
        startMin: timeStringToMinutes(e.time || e.start_time || '00:00'),
      }))
      .filter((item) => item.startMin > currentMin)
      .sort((a, b) => a.startMin - b.startMin);

    if (futureEvents.length > 0) {
      nextEvent = futureEvents[0].event;
      minutesUntilNext = futureEvents[0].startMin - currentMin;
    }
  }

  // 4. Imminent Event (Within 60 mins)
  if (nextEvent && minutesUntilNext !== undefined && minutesUntilNext <= 60 && minutesUntilNext > 0) {
    return {
      moodKey: 'upcoming-soon',
      greeting,
      headline: `اللي جاي 👀: ${nextEvent.title}`,
      subtext: `فاضل تقريباً ${minutesUntilNext} دقيقة، جهز نفسك براحة.`,
      badge: 'قريب جداً ⏰',
      nextEvent,
      minutesUntilNext,
      highlightCategory: nextEvent.categoryLabel,
    };
  }

  // 5. Late Evening Winddown
  if (isToday && currentHour >= 21) {
    if (pendingTasks.length > 0) {
      return {
        moodKey: 'evening-winddown',
        greeting,
        headline: 'مساء الخير.. فاضل كام حاجة خفيفة 🌙',
        subtext: `باقي ${pendingTasks.length} مهام مفتوحة. نخليهم لبكرة ولا نخلصهم دلوقتي؟`,
        badge: 'ختام اليوم',
      };
    } else {
      return {
        moodKey: 'evening-winddown',
        greeting,
        headline: 'ختام رايق ليوم طويل ☕️',
        subtext: tomorrowEvents.length > 0
          ? `بكرة عندك ${tomorrowEvents.length} مواعيد، بص عليهم قبل ما تنام.`
          : 'بكرة يومك فاضي ورايق، نوم هني مقدماً.',
        badge: 'ليلة هادية',
      };
    }
  }

  // 6. Heavy / Busy Day
  if (events.length >= 4 || totalItems >= 7) {
    return {
      moodKey: 'very-busy',
      greeting,
      headline: 'خد بالك 👀 النهارده زحمة شوية',
      subtext: `وراك ${pendingEvents.length} مواعيد و${pendingTasks.length} مهام متبقية. هنمشيها واحدة واحدة ومش هنزنق نفسنا.`,
      badge: 'يوم مليان ⚡️',
      nextEvent,
    };
  }

  // 7. Moderate Day
  if (totalItems >= 3) {
    return {
      moodKey: 'busy',
      greeting,
      headline: 'بص كده على يومك.. مرتب ومنظم 📋',
      subtext: nextEvent
        ? `ميعادك اللي جاي ${nextEvent.title} الساعة ${nextEvent.time}.`
        : `وراك ${pendingTasks.length} حاجات متبقية، نخلصهم ورا بعض.`,
      badge: `${pendingEvents.length + pendingTasks.length} باقيين`,
      nextEvent,
    };
  }

  // 8. Calm / Light Day
  return {
    moodKey: 'calm',
    greeting,
    headline: 'النهارده رايق أوي 😌',
    subtext: 'وراك حاجات بسيطة وتقدر تاخد وقتك براحتك ومفيش ضغط.',
    badge: 'يوم خفيف',
    nextEvent,
  };
}
