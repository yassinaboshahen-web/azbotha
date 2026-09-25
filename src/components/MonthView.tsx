import React, { useState, useMemo, useEffect } from 'react';
import { CalendarEvent, TaskItem } from '../types';
import { parseDateString, formatDateToISO, getTodayDateString } from '../utils/dateUtils';
import { ChevronRight, ChevronLeft, Sparkles, Calendar as CalendarIcon, Target, Flame, Share2 } from 'lucide-react';
import { calculateReportMetrics, CATEGORY_LABELS } from '../utils/reportUtils';
import { WeeklyExportModal } from './WeeklyExportModal';
import { sound } from '../utils/audio';

interface MonthViewProps {
  currentDateStr: string;
  events: CalendarEvent[];
  tasks: TaskItem[];
  onSelectDate: (dateStr: string) => void;
}

const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const ARABIC_WEEKDAYS_SHORT = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export const MonthView: React.FC<MonthViewProps> = ({
  currentDateStr,
  events,
  tasks,
  onSelectDate,
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => parseDateString(currentDateStr));
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    setViewDate(parseDateString(currentDateStr));
  }, [currentDateStr]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = () => {
    sound.playTap();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    sound.playTap();
    setViewDate(new Date(year, month + 1, 1));
  };

  // Compute days grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startStr = formatDateToISO(firstDayOfMonth);
  const endStr = formatDateToISO(lastDayOfMonth);

  const metrics = useMemo(() => 
    calculateReportMetrics(events, tasks, startStr, endStr),
    [events, tasks, startStr, endStr]
  );

  // Day of week for 1st of month: 0 (Sun) to 6 (Sat).
  // In Egypt week starts on Saturday (Sat = 0 offset, Sun = 1, Mon = 2, ..., Fri = 6)
  const startDayOfWeek = (firstDayOfMonth.getDay() + 1) % 7;
  const totalDays = lastDayOfMonth.getDate();

  // Preceding padding days from prev month
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const paddingBefore = Array.from({ length: startDayOfWeek }, (_, i) => {
    const dayNum = prevMonthLastDay - startDayOfWeek + 1 + i;
    return {
      dayNum,
      isCurrentMonth: false,
      dateStr: formatDateToISO(new Date(year, month - 1, dayNum)),
    };
  });

  // Current month days
  const currentDays = Array.from({ length: totalDays }, (_, i) => {
    const dayNum = i + 1;
    return {
      dayNum,
      isCurrentMonth: true,
      dateStr: formatDateToISO(new Date(year, month, dayNum)),
    };
  });

  const allGridDays = [...paddingBefore, ...currentDays];

  const todayStr = getTodayDateString();

  const maxCategoryCount = Math.max(...Object.values(metrics.categoryDistribution), 1);

  return (
    <div className="py-4 px-3 sm:px-6 max-w-3xl mx-auto space-y-6">
      {/* Month Header Controller */}
      <div className="bg-white/80 border border-[#E4DED4] rounded-3xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-[#C58B5C]" />
          <h2 className="text-lg sm:text-xl font-bold text-[#243B35]">
            {ARABIC_MONTH_NAMES[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-[#F6F3EE] p-1 rounded-full border border-[#E4DED4]">
          <button
            onClick={handlePrevMonth}
            aria-label="الشهر السابق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            aria-label="الشهر التالي"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month Summary Card */}
      <div className="bg-white/90 border border-[#D8C3A5]/50 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-[#E4DED4] pb-3">
            <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#6F8F78]" />
                <h3 className="text-sm font-bold text-[#243B35]">ملخص الشهر</h3>
            </div>
            <button 
                onClick={() => setIsExportOpen(true)}
                className="text-[11px] font-bold text-[#C58B5C] flex items-center gap-1 hover:underline cursor-pointer"
            >
                <Share2 className="w-3 h-3" />
                <span>شارك الملخص</span>
            </button>
        </div>

        {metrics.totalEvents + metrics.totalTasks === 0 ? (
            <p className="text-center text-xs text-[#A3A198] py-4 italic">
                الشهر ده لسه هادي، مفيش مواعيد أو مهام مسجلة. 😌
            </p>
        ) : (
            <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-[#77766F] mb-1">نسبة الإنجاز</div>
                        <div className="text-xl font-bold text-[#6F8F78]">{metrics.completionRate}%</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-[#77766F] mb-1">إجمالي العناصر</div>
                        <div className="text-xl font-bold text-[#243B35]">{metrics.totalEvents + metrics.totalTasks}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-[#77766F] mb-1">أكتر يوم زحمة</div>
                        <div className="text-sm font-bold text-[#C58B5C]">{metrics.busiestDay?.name || '---'}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-bold text-[#77766F] mb-1">مهام متأخرة</div>
                        <div className="text-xl font-bold text-[#B86B61]">{metrics.overdueTasksCount}</div>
                    </div>
                </div>

                {/* Category Bars */}
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-[#77766F] px-1 uppercase tracking-wider">توزيع المواعيد حسب النوع:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(metrics.categoryDistribution).map(([cat, count]) => {
                            if (count === 0) return null;
                            const percentage = (count / maxCategoryCount) * 100;
                            return (
                                <div key={cat} className="flex items-center gap-3">
                                    <span className="text-[10px] font-medium text-[#242522] w-14 shrink-0">{CATEGORY_LABELS[cat] || cat}</span>
                                    <div className="flex-1 bg-[#F6F3EE] h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-[#243B35] h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#77766F] w-4 text-left">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-3xl border border-[#E4DED4] p-4 sm:p-6 shadow-xs">
        {/* Weekday Names Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-3">
          {ARABIC_WEEKDAYS_SHORT.map((dayName) => (
            <div
              key={dayName}
              className="text-xs font-bold text-[#77766F] py-1.5"
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {allGridDays.map((item, idx) => {
            const dayEvents = events.filter((e) => e.date === item.dateStr);
            const dayTasks = tasks.filter((t) => t.date === item.dateStr);
            const totalItems = dayEvents.length + dayTasks.length;

            const isToday = item.dateStr === todayStr;
            const isSelected = item.dateStr === currentDateStr;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  sound.playPop();
                  onSelectDate(item.dateStr);
                }}
                aria-label={`${item.dayNum} ${ARABIC_MONTH_NAMES[month]} ${item.isCurrentMonth && totalItems > 0 ? `- وراك ${totalItems} حاجات` : ''}`}
                className={`relative min-h-[58px] sm:min-h-[72px] p-2 rounded-2xl flex flex-col justify-between items-center text-right transition-all duration-150 cursor-pointer border focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none ${
                  !item.isCurrentMonth
                    ? 'opacity-30 border-transparent hover:opacity-60'
                    : isSelected
                    ? 'bg-[#243B35] text-[#F6F3EE] border-[#243B35] shadow-sm ring-2 ring-[#C58B5C]'
                    : isToday
                    ? 'bg-[#F4E8DE] border-[#C58B5C] text-[#243B35]'
                    : 'bg-[#F6F3EE]/60 border-[#E4DED4] hover:bg-[#F6F3EE] hover:border-[#CEC4B5]'
                }`}
              >
                {/* Day Number */}
                <span
                  className={`text-xs sm:text-sm font-bold ${
                    isSelected ? 'text-[#D8C3A5]' : isToday ? 'text-[#C58B5C]' : 'text-[#243B35]'
                  }`}
                >
                  {item.dayNum}
                </span>

                {/* Activity Dots / Density Indicator */}
                {item.isCurrentMonth && totalItems > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {dayEvents.length > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#D8C3A5]' : 'bg-[#243B35]'
                        }`}
                        title={`${dayEvents.length} مواعيد`}
                      />
                    )}
                    {dayTasks.length > 0 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-[#C58B5C]' : 'bg-[#C58B5C]'
                        }`}
                        title={`${dayTasks.length} مهام`}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly Export Modal */}
      <WeeklyExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        metrics={metrics}
        periodName={`شهر ${ARABIC_MONTH_NAMES[month]}`}
      />
    </div>
  );
};

