import React, { useState, useMemo } from 'react';
import { CalendarEvent, TaskItem } from '../types';
import { parseDateString, formatDateToISO, formatTime12h, getTodayDateString } from '../utils/dateUtils';
import { Share2, Clock, ChevronLeft, ChevronRight, Calendar as CalIcon, Flame, Target } from 'lucide-react';
import { WeeklyExportModal } from './WeeklyExportModal';
import { calculateReportMetrics } from '../utils/reportUtils';
import { sound } from '../utils/audio';

interface WeekViewProps {
  currentDateStr: string;
  events: CalendarEvent[];
  tasks: TaskItem[];
  onSelectDay: (dateStr: string) => void;
  onChangeDate?: (dateStr: string) => void;
}

const ARABIC_DAYS_ORDER = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export const WeekView: React.FC<WeekViewProps> = ({
  currentDateStr,
  events,
  tasks,
  onSelectDay,
  onChangeDate,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Generate 7 days around the active date (current week Saturday to Friday)
  const activeDate = parseDateString(currentDateStr);
  const dayOfWeek = activeDate.getDay();
  // Adjust to start from Saturday (6 in JS is Sat, we want diff to Sat)
  // JS Day: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6)
  // Our Order: Sat, Sun, Mon, Tue, Wed, Thu, Fri
  const diffToSaturday = (dayOfWeek + 1) % 7;
  const startOfWeek = new Date(activeDate);
  startOfWeek.setDate(activeDate.getDate() - diffToSaturday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startStr = formatDateToISO(startOfWeek);
  const endStr = formatDateToISO(endOfWeek);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = formatDateToISO(d);
    const dayEvents = events.filter((e) => e.date === dateStr);
    const dayTasks = tasks.filter((t) => t.date === dateStr);

    return {
      date: dateStr,
      dayName: ARABIC_DAYS_ORDER[i],
      dayNumber: d.getDate(),
      isToday: dateStr === getTodayDateString(),
      isSelected: dateStr === currentDateStr,
      events: dayEvents,
      tasks: dayTasks,
    };
  });

  const metrics = useMemo(() => 
    calculateReportMetrics(events, tasks, startStr, endStr),
    [events, tasks, startStr, endStr]
  );

  const handlePrevWeek = () => {
    sound.playTap();
    const prev = new Date(activeDate);
    prev.setDate(activeDate.getDate() - 7);
    const dateStr = formatDateToISO(prev);
    if (onChangeDate) {
        onChangeDate(dateStr);
    } else {
        onSelectDay(dateStr);
    }
  };

  const handleNextWeek = () => {
    sound.playTap();
    const next = new Date(activeDate);
    next.setDate(activeDate.getDate() + 7);
    const dateStr = formatDateToISO(next);
    if (onChangeDate) {
        onChangeDate(dateStr);
    } else {
        onSelectDay(dateStr);
    }
  };

  return (
    <div className="py-4 px-3 sm:px-6 max-w-4xl mx-auto space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white/60 p-2 rounded-2xl border border-[#E4DED4]">
        <button 
          onClick={handlePrevWeek}
          className="p-2 hover:bg-[#F6F3EE] rounded-xl transition-colors cursor-pointer"
          aria-label="الأسبوع السابق"
        >
          <ChevronRight className="w-5 h-5 text-[#243B35]" />
        </button>
        <div className="text-xs font-bold text-[#243B35]">
          من {startOfWeek.getDate()} {startOfWeek.toLocaleDateString('ar-EG', { month: 'short' })} لـ {endOfWeek.getDate()} {endOfWeek.toLocaleDateString('ar-EG', { month: 'short' })}
        </div>
        <button 
          onClick={handleNextWeek}
          className="p-2 hover:bg-[#F6F3EE] rounded-xl transition-colors cursor-pointer"
          aria-label="الأسبوع التالي"
        >
          <ChevronLeft className="w-5 h-5 text-[#243B35]" />
        </button>
      </div>

      {/* Week Header & Summary Banner */}
      <div className="bg-white/80 border border-[#E4DED4] rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalIcon className="w-4 h-4 text-[#C58B5C]" />
              <span className="text-xs font-bold text-[#C58B5C]">
                نظرة عامة على الأسبوع
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#243B35]">
              الأسبوع ده عامل إزاي؟
            </h2>
          </div>

          <button
            onClick={() => {
              sound.playTap();
              setIsExportOpen(true);
            }}
            className="self-start sm:self-center px-4 py-2.5 rounded-2xl bg-[#243B35] text-[#F6F3EE] text-xs sm:text-sm font-bold hover:bg-[#1b2d28] transition-colors flex items-center gap-2 shadow-xs active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
          >
            <Share2 className="w-4 h-4 text-[#D8C3A5]" />
            <span>شارك أسبوعك</span>
          </button>
        </div>

        {/* Factual Information Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#E4DED4]/60">
          <div className="bg-[#F6F3EE] p-3 rounded-2xl border border-[#E4DED4]">
            <span className="block text-[11px] text-[#77766F] font-medium mb-0.5">
              المواعيد
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#243B35]">
              {metrics.totalEvents} مواعيد
            </span>
          </div>

          <div className="bg-[#F6F3EE] p-3 rounded-2xl border border-[#E4DED4]">
            <span className="block text-[11px] text-[#77766F] font-medium mb-0.5">
              المهام
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#243B35]">
              {metrics.totalTasks} مهمة
            </span>
          </div>

          <div className="bg-[#F6F3EE] p-3 rounded-2xl border border-[#E4DED4]">
            <span className="block text-[11px] text-[#77766F] font-medium mb-0.5">
              نسبة الإنجاز
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#6F8F78]">
              {metrics.completionRate}%
            </span>
          </div>

          <div className="bg-[#F6F3EE] p-3 rounded-2xl border border-[#E4DED4]">
            <span className="block text-[11px] text-[#77766F] font-medium mb-0.5">
              متأخر
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#B86B61]">
              {metrics.overdueTasksCount} متأخر
            </span>
          </div>
        </div>

        {/* Factual Highlights Bar */}
        {metrics.busiestDay && (
          <div className="mt-3.5 pt-3 border-t border-[#E4DED4]/50 flex items-center justify-between text-xs text-[#77766F]">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#C58B5C]" />
              <span className="font-semibold text-[#243B35]">
                اليوم الأكثر انشغالاً: {metrics.busiestDay.name}
              </span>
              <span>
                ({metrics.busiestDay.count} حاجات)
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#6F8F78] font-bold">
              <Target className="w-3 h-3" />
              <span>خلصت {metrics.completedEvents + metrics.completedTasks} حاجة الأسبوع ده</span>
            </div>
          </div>
        )}

        {metrics.totalEvents + metrics.totalTasks === 0 && (
          <div className="mt-3 pt-3 border-t border-[#E4DED4]/50 text-xs text-[#A3A198] text-center">
            مفيش مواعيد أو مهام مسجلة في الأسبوع ده حتى الآن.
          </div>
        )}
      </div>

      {/* 7 Days Editorial Visual Density Deck */}
      <div className="space-y-3">
        {weekDays.map((day) => {
          const densityScore = Math.min(day.events.length * 25 + day.tasks.length * 15, 100);

          return (
            <div
              key={day.date}
              role="button"
              tabIndex={0}
              onClick={() => {
                sound.playTap();
                onSelectDay(day.date);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  sound.playTap();
                  onSelectDay(day.date);
                }
              }}
              aria-label={`${day.dayName} ${day.dayNumber} - ${day.events.length} مواعيد و ${day.tasks.length} مهام`}
              className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer border focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none ${
                day.isSelected
                  ? 'bg-white border-[#243B35] shadow-md ring-1 ring-[#243B35]/20'
                  : 'bg-white/70 border-[#E4DED4] hover:bg-white hover:border-[#CEC4B5]'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      day.isToday
                        ? 'bg-[#243B35] text-[#D8C3A5]'
                        : 'bg-[#E4DED4] text-[#243B35]'
                    }`}
                  >
                    {day.dayNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#243B35]">
                      {day.dayName}
                    </h3>
                    <span className="text-[11px] text-[#77766F]">
                      {day.events.length} مواعيد · {day.tasks.length} مهام
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {day.isToday && (
                    <span className="text-xs font-bold text-[#C58B5C]">
                      · النهارده
                    </span>
                  )}
                  <ChevronLeft className="w-4 h-4 text-[#A3A198]" />
                </div>
              </div>

              {/* Workload Density Bar */}
              <div className="w-full bg-[#E4DED4]/50 h-1.5 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    densityScore > 65
                      ? 'bg-[#C58B5C]'
                      : densityScore > 30
                      ? 'bg-[#243B35]'
                      : 'bg-[#6F8F78]'
                  }`}
                  style={{ width: `${Math.max(densityScore, 10)}%` }}
                />
              </div>

              {/* Day's Event Previews */}
              {day.events.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {day.events.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="text-xs bg-[#F6F3EE] px-2.5 py-1 rounded-xl text-[#242522] border border-[#E4DED4]/60 flex items-center gap-1.5"
                    >
                      <Clock className="w-3 h-3 text-[#A3A198]" />
                      <span className="font-semibold text-[#C58B5C] tabular-nums">
                        {formatTime12h(e.time)}
                      </span>
                      <span className="truncate max-w-[150px]">{e.title}</span>
                    </div>
                  ))}
                  {day.events.length > 3 && (
                    <span className="text-[11px] text-[#77766F] self-center">
                      +{day.events.length - 3} مواعيد تانية
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#A3A198] italic">
                  مفيش مواعيد مسجلة
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Weekly Export Modal */}
      <WeeklyExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        metrics={metrics}
        periodName="الأسبوع ده"
      />
    </div>
  );
};

