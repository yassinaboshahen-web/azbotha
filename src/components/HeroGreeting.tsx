import React, { useState } from 'react';
import { CalendarEvent, TaskItem } from '../types';
import { formatArabicFullDate, getTodayDateString } from '../utils/dateUtils';
import { evaluateSmartDayContext } from '../utils/smartContextEngine';
import { ChevronRight, ChevronLeft, Sparkles, Clock, Calendar as CalendarIcon, Share2 } from 'lucide-react';
import { sound } from '../utils/audio';
import { DateJumpSheet } from './DateJumpSheet';

interface HeroGreetingProps {
  currentDateStr: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onSelectDate?: (dateStr: string) => void;
  onJumpToToday?: () => void;
  onOpenExport?: () => void;
  events: CalendarEvent[];
  tasks: TaskItem[];
  tomorrowEvents?: CalendarEvent[];
  tomorrowTasks?: TaskItem[];
  onSelectNextEvent?: (event: CalendarEvent) => void;
}

export const HeroGreeting: React.FC<HeroGreetingProps> = ({
  currentDateStr,
  onPrevDay,
  onNextDay,
  onSelectDate,
  onJumpToToday,
  onOpenExport,
  events,
  tasks,
  tomorrowEvents = [],
  tomorrowTasks = [],
  onSelectNextEvent,
}) => {
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const { formattedDate, isToday, isTomorrow, isYesterday } = formatArabicFullDate(currentDateStr);
  const todayStr = getTodayDateString();
  const isPast = currentDateStr < todayStr;

  const smartContext = evaluateSmartDayContext({
    dateStr: currentDateStr,
    events,
    tasks,
    tomorrowEvents,
    tomorrowTasks,
  });

  return (
    <section className="pt-5 pb-3 px-4 sm:px-6 max-w-3xl mx-auto transition-all">
      {/* Friendly Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243B35]">
            {smartContext.greeting}
          </h1>
          {smartContext.badge && (
            <span className="text-xs font-semibold text-[#77766F] select-none whitespace-nowrap">
              · {smartContext.badge}
            </span>
          )}
        </div>

        {/* Date Cycler / Nav */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#E4DED4]/50 border border-[#E4DED4] p-1 rounded-full">
          <button
            onClick={() => {
              sound.playTap();
              onPrevDay();
            }}
            aria-label="اليوم السابق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-[#243B35] px-2 min-w-[70px] text-center select-none">
            {isToday ? 'النهارده' : isTomorrow ? 'بكرة' : isYesterday ? 'إمبارح' : 'يوم آخر'}
          </span>

          <button
            onClick={() => {
              sound.playTap();
              onNextDay();
            }}
            aria-label="اليوم التالي"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Date Header */}
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <button
          onClick={() => {
            sound.playTap();
            setIsJumpOpen(true);
          }}
          className="text-lg sm:text-xl font-bold text-[#243B35] hover:text-[#C58B5C] transition-colors flex items-center gap-2 group cursor-pointer text-right"
          title="انقر لتغيير التاريخ أو القفز ليوم محدد"
        >
          <span>{formattedDate}</span>
          <CalendarIcon className="w-4 h-4 text-[#C58B5C] opacity-75 group-hover:opacity-100 transition-opacity" />
        </button>

        {isPast && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#E4DED4]/80 text-[#77766F] inline-flex items-center gap-1 select-none">
            <span>🕰️</span>
            <span>من الماضي</span>
          </span>
        )}

        {!isToday && onJumpToToday && (
          <button
            onClick={() => {
              sound.playTap();
              onJumpToToday();
            }}
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <span>رجوع للنهارده</span>
          </button>
        )}

        {onOpenExport && (
          <button
            onClick={() => {
              sound.playTap();
              onOpenExport();
            }}
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F6F3EE] text-[#243B35] border border-[#E4DED4] hover:bg-[#E4DED4] transition-colors inline-flex items-center gap-1 cursor-pointer ms-auto"
            title="تصدير ومشاركة جدول اليوم"
          >
            <Share2 className="w-3.5 h-3.5 text-[#C58B5C]" />
            <span>مشاركة الجدول</span>
          </button>
        )}
      </div>

      {onSelectDate && (
        <DateJumpSheet
          isOpen={isJumpOpen}
          onClose={() => setIsJumpOpen(false)}
          mode="day"
          currentDateStr={currentDateStr}
          onSelectDate={onSelectDate}
        />
      )}

      {/* Dynamic Context Headline & Subtext Card - Only shown when day has items to avoid duplicate empty card */}
      {(events.length > 0 || tasks.length > 0) && (
        <div className="bg-white/80 border border-[#E4DED4] rounded-2xl p-4 shadow-xs transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm sm:text-base font-bold text-[#243B35] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C58B5C] shrink-0" />
                <span>{smartContext.headline}</span>
              </p>
              <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed pr-6">
                {smartContext.subtext}
              </p>
            </div>

            {smartContext.nextEvent && onSelectNextEvent && (
              <button
                onClick={() => {
                  sound.playTap();
                  if (smartContext.nextEvent) onSelectNextEvent(smartContext.nextEvent);
                }}
                className="shrink-0 text-xs font-bold text-[#C58B5C] bg-[#FBF0E4] hover:bg-[#f6e4d2] px-3 py-1.5 rounded-xl border border-[#E8CEB5] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تفاصيل اللي جاي</span>
                <span className="sm:hidden">التفاصيل</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
