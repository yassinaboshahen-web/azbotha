const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const parseDateString = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDateToISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDateString = (): string => {
  return formatDateToISO(new Date());
};

export const getRelativeDateString = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateToISO(d);
};

export const formatArabicFullDate = (dateStr: string): { dayName: string; formattedDate: string; isToday: boolean; isTomorrow: boolean; isYesterday: boolean } => {
  const d = parseDateString(dateStr);
  const now = new Date();
  
  const todayStr = formatDateToISO(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateToISO(tomorrow);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateToISO(yesterday);

  const dayName = ARABIC_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = ARABIC_MONTHS[d.getMonth()];
  const formattedDate = `${dayName}، ${dayNum} ${monthName}`;

  return {
    dayName,
    formattedDate,
    isToday: dateStr === todayStr,
    isTomorrow: dateStr === tomorrowStr,
    isYesterday: dateStr === yesterdayStr,
  };
};

export const formatTime12h = (time24: string): string => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const suffix = h >= 12 ? 'م' : 'ص';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${suffix}`;
};

export const getCurrentTimeMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const formatDurationArabic = (startTime: string, endTime?: string): string => {
  if (!startTime || !endTime) return '';
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime);
  const diff = endMin - startMin;
  if (diff <= 0) return '';

  if (diff === 30) return 'نص ساعة';
  if (diff === 45) return '٤٥ دقيقة';
  if (diff === 60) return 'ساعة';
  if (diff === 90) return 'ساعة ونصف';
  if (diff === 120) return 'ساعتين';
  if (diff > 120 && diff % 60 === 0) return `${diff / 60} ساعات`;
  if (diff > 60) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `ساعة و ${mins} دقيقة`;
  }
  return `${diff} دقيقة`;
};

export const checkEventsTimeOverlap = (
  eventA: { time: string; endTime?: string },
  eventB: { time: string; endTime?: string }
): boolean => {
  if (!eventA.time || !eventB.time) return false;
  const aStart = timeStringToMinutes(eventA.time);
  const aEnd = timeStringToMinutes(eventA.endTime || eventA.time) || aStart + 60;
  const bStart = timeStringToMinutes(eventB.time);
  const bEnd = timeStringToMinutes(eventB.endTime || eventB.time) || bStart + 60;

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
};

export const getEventStatus = (
  eventDate: string,
  startTime: string,
  endTime?: string,
  isCompleted?: boolean
): 'past' | 'current' | 'next' | 'later' => {
  if (isCompleted) return 'past';

  const todayStr = formatDateToISO(new Date());
  if (eventDate < todayStr) return 'past';
  if (eventDate > todayStr) return 'later';

  // For today:
  const nowMinutes = getCurrentTimeMinutes();
  const startMin = timeStringToMinutes(startTime);
  const endMin = timeStringToMinutes(endTime || startTime);

  // If current time falls inside the event window
  if (nowMinutes >= startMin && nowMinutes <= Math.max(endMin, startMin + 30)) {
    return 'current';
  }

  if (nowMinutes > Math.max(endMin, startMin + 30)) {
    return 'past';
  }

  // Upcoming
  if (startMin - nowMinutes <= 90 && startMin > nowMinutes) {
    return 'next';
  }

  return 'later';
};

export const getDayMoodMessage = (
  eventsCount: number,
  tasksCount: number,
  completedEvents: number,
  completedTasks: number
): { status: 'light' | 'busy' | 'very-busy' | 'done'; message: string; submessage: string } => {
  const total = eventsCount + tasksCount;
  const completedTotal = completedEvents + completedTasks;

  if (total > 0 && completedTotal >= total) {
    return {
      status: 'done',
      message: 'كده خلصنا 😌',
      submessage: 'يومك مشي على أكمل وجه، ارتاح واستمتع بوقتك.',
    };
  }

  if (eventsCount <= 2 && tasksCount <= 2) {
    return {
      status: 'light',
      message: 'النهارده رايق أوي 😌',
      submessage: 'وراك حاجات بسيطة وتقدر تاخد وقتك براحتك.',
    };
  }

  if (eventsCount >= 5 || total >= 8) {
    return {
      status: 'very-busy',
      message: 'النهارده مليان شوية ⚡️',
      submessage: 'خلينا نمشيها واحدة واحدة ومش هنزنق نفسنا.',
    };
  }

  return {
    status: 'busy',
    message: 'خد بالك 👀 النهارده زحمة شوية',
    submessage: 'رتب أولوياتك ونخلصهم سوا ورا بعض.',
  };
};

export const getWeekRange = (
  dateStr: string,
  weekStartsOn: 'saturday' | 'sunday' | 'monday' = 'saturday'
): { startDate: string; endDate: string } => {
  const d = parseDateString(dateStr);
  const day = d.getDay();
  let diff = 0;
  if (weekStartsOn === 'saturday') {
    diff = (day + 1) % 7;
  } else if (weekStartsOn === 'sunday') {
    diff = day;
  } else {
    diff = (day + 6) % 7;
  }
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startDate: formatDateToISO(start),
    endDate: formatDateToISO(end),
  };
};

export const getMonthRange = (dateStr: string): { startDate: string; endDate: string } => {
  const d = parseDateString(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    startDate: formatDateToISO(start),
    endDate: formatDateToISO(end),
  };
};

