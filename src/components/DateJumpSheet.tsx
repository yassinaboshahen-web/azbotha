import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import {
  ARABIC_MONTHS,
  formatDateToISO,
  parseDateString,
  getTodayDateString,
  getDaysInMonth,
  clampDateToRange,
} from '../utils/dateUtils';
import { sound } from '../utils/audio';

export type DateJumpMode = 'day' | 'week' | 'month';

export interface DateJumpSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: DateJumpMode;
  currentDateStr: string;
  onSelectDate: (dateStr: string) => void;
}

const ARABIC_WEEKDAYS_SHORT = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export const DateJumpSheet: React.FC<DateJumpSheetProps> = ({
  isOpen,
  onClose,
  mode,
  currentDateStr,
  onSelectDate,
}) => {
  const todayStr = getTodayDateString();
  const todayDate = useMemo(() => parseDateString(todayStr), [todayStr]);

  const [activeYear, setActiveYear] = useState<number>(() => {
    const d = parseDateString(clampDateToRange(currentDateStr));
    return d.getFullYear();
  });

  const [activeMonth, setActiveMonth] = useState<number>(() => {
    const d = parseDateString(clampDateToRange(currentDateStr));
    return d.getMonth();
  });

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const d = parseDateString(clampDateToRange(currentDateStr));
    return d.getDate();
  });

  // 'calendar' for day/week picker, 'monthGrid' for month picker, 'yearGrid' for fast year selection
  const [subView, setSubView] = useState<'calendar' | 'monthGrid' | 'yearGrid'>(() => {
    return mode === 'month' ? 'monthGrid' : 'calendar';
  });

  // Re-sync with currentDateStr whenever sheet opens
  useEffect(() => {
    if (!isOpen) return;
    const clamped = clampDateToRange(currentDateStr);
    const d = parseDateString(clamped);
    setActiveYear(d.getFullYear());
    setActiveMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setSubView(mode === 'month' ? 'monthGrid' : 'calendar');
  }, [isOpen, currentDateStr, mode]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Month navigation handlers
  const handlePrevMonth = () => {
    sound.playTap();
    if (activeMonth === 0) {
      if (activeYear > 2000) {
        setActiveYear(activeYear - 1);
        setActiveMonth(11);
      }
    } else {
      setActiveMonth(activeMonth - 1);
    }
  };

  const handleNextMonth = () => {
    sound.playTap();
    if (activeMonth === 11) {
      if (activeYear < 2100) {
        setActiveYear(activeYear + 1);
        setActiveMonth(0);
      }
    } else {
      setActiveMonth(activeMonth + 1);
    }
  };

  const handlePrevYear = () => {
    sound.playTap();
    if (activeYear > 2000) {
      setActiveYear((y) => Math.max(2000, y - 1));
    }
  };

  const handleNextYear = () => {
    sound.playTap();
    if (activeYear < 2100) {
      setActiveYear((y) => Math.min(2100, y + 1));
    }
  };

  const handleJumpToToday = () => {
    sound.playPop();
    const clampedToday = clampDateToRange(todayStr);
    onSelectDate(clampedToday);
    onClose();
  };

  // Selection handlers
  const handlePickMonth = (mIdx: number) => {
    sound.playPop();
    setActiveMonth(mIdx);

    if (mode === 'month') {
      const clamped = clampDateToRange(`${activeYear}-${String(mIdx + 1).padStart(2, '0')}-01`);
      onSelectDate(clamped);
      onClose();
    } else {
      setSubView('calendar');
    }
  };

  const handlePickYear = (year: number) => {
    sound.playTap();
    setActiveYear(year);
    if (mode === 'month') {
      setSubView('monthGrid');
    } else {
      setSubView('calendar');
    }
  };

  const handlePickDay = (dayNum: number, targetMonth: number = activeMonth, targetYear: number = activeYear) => {
    sound.playPop();
    const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const clamped = clampDateToRange(dateStr);
    onSelectDate(clamped);
    onClose();
  };

  // Calendar Grid computation for day/week mode
  const totalDaysInMonth = getDaysInMonth(activeYear, activeMonth);
  const firstDayOfMonth = new Date(activeYear, activeMonth, 1);
  // Saturday = 0 in Egyptian week (0 = Sat, 1 = Sun, ..., 6 = Fri)
  const startDayOfWeek = (firstDayOfMonth.getDay() + 1) % 7;

  // Days from previous month
  const prevMonthDaysCount = getDaysInMonth(
    activeMonth === 0 ? activeYear - 1 : activeYear,
    activeMonth === 0 ? 11 : activeMonth - 1
  );

  const prevMonthCells = Array.from({ length: startDayOfWeek }, (_, i) => {
    const day = prevMonthDaysCount - startDayOfWeek + 1 + i;
    const m = activeMonth === 0 ? 11 : activeMonth - 1;
    const y = activeMonth === 0 ? activeYear - 1 : activeYear;
    return { day, month: m, year: y, isCurrentMonth: false };
  });

  const currentMonthCells = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const day = i + 1;
    return { day, month: activeMonth, year: activeYear, isCurrentMonth: true };
  });

  // Pad remaining cells to complete grid row of 7
  const totalSoFar = prevMonthCells.length + currentMonthCells.length;
  const paddingAfterCount = (7 - (totalSoFar % 7)) % 7;
  const nextMonthCells = Array.from({ length: paddingAfterCount }, (_, i) => {
    const day = i + 1;
    const m = activeMonth === 11 ? 0 : activeMonth + 1;
    const y = activeMonth === 11 ? activeYear + 1 : activeYear;
    return { day, month: m, year: y, isCurrentMonth: false };
  });

  const calendarGrid = [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];

  // Year quick options (around activeYear)
  const yearRangeStart = Math.max(2000, activeYear - 6);
  const yearRangeEnd = Math.min(2100, yearRangeStart + 15);
  const yearsList = Array.from({ length: yearRangeEnd - yearRangeStart + 1 }, (_, i) => yearRangeStart + i);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div className="relative z-10 w-full max-w-md bg-[#F6F3EE] rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#243B35] flex items-center justify-center text-[#D8C3A5]">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
                {mode === 'month'
                  ? 'انتقال لشهر محدد'
                  : mode === 'week'
                  ? 'انتقال لأسبوع محدد'
                  : 'انتقال لتاريخ محدد'}
              </h2>
              <p className="text-[11px] text-[#77766F]">
                {mode === 'week' ? 'اختر أي يوم لتحديد أسبوعه' : 'تصفح كل التواريخ بسهولة (2000 - 2100)'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Switcher / Year & Month Navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-2 border border-[#E4DED4] mb-4 shadow-xs">
          {/* Year controller with arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevYear}
              disabled={activeYear <= 2000}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] disabled:opacity-30 cursor-pointer"
              aria-label="السنة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                sound.playTap();
                setSubView(subView === 'yearGrid' ? (mode === 'month' ? 'monthGrid' : 'calendar') : 'yearGrid');
              }}
              className="px-2 py-1 rounded-lg text-xs font-bold text-[#243B35] hover:bg-[#F6F3EE] transition-colors cursor-pointer"
            >
              {activeYear}
            </button>
            <button
              onClick={handleNextYear}
              disabled={activeYear >= 2100}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] disabled:opacity-30 cursor-pointer"
              aria-label="السنة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Month selector button / month navigators (if in calendar mode) */}
          {mode !== 'month' && subView === 'calendar' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] cursor-pointer"
                aria-label="الشهر السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sound.playTap();
                  setSubView('monthGrid');
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#C58B5C] hover:bg-[#F6F3EE] transition-colors cursor-pointer"
              >
                {ARABIC_MONTHS[activeMonth]}
              </button>
              <button
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] cursor-pointer"
                aria-label="الشهر التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                sound.playTap();
                setSubView(subView === 'monthGrid' ? 'calendar' : 'monthGrid');
              }}
              className="px-3 py-1 rounded-lg text-xs font-bold text-[#C58B5C] hover:bg-[#F6F3EE] cursor-pointer"
            >
              {ARABIC_MONTHS[activeMonth]}
            </button>
          )}
        </div>

        {/* SUBVIEW 1: YEAR GRID */}
        {subView === 'yearGrid' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-[#77766F] px-1">اختر السنة:</div>
            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
              {yearsList.map((y) => (
                <button
                  key={y}
                  onClick={() => handlePickYear(y)}
                  className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                    y === activeYear
                      ? 'bg-[#243B35] text-[#F6F3EE] border-[#243B35]'
                      : y === todayDate.getFullYear()
                      ? 'bg-[#F4E8DE] text-[#243B35] border-[#C58B5C]'
                      : 'bg-white text-[#243B35] border-[#E4DED4] hover:bg-[#F6F3EE]'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW 2: MONTH GRID (12 Months) */}
        {subView === 'monthGrid' && (
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-[#77766F] px-1">اختر الشهر:</div>
            <div className="grid grid-cols-3 gap-2 p-1">
              {ARABIC_MONTHS.map((name, mIdx) => {
                const isSelected = mIdx === activeMonth && activeYear === parseDateString(currentDateStr).getFullYear();
                const isCurrent = mIdx === todayDate.getMonth() && activeYear === todayDate.getFullYear();

                return (
                  <button
                    key={name}
                    onClick={() => handlePickMonth(mIdx)}
                    className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#243B35] text-[#F6F3EE] border-[#243B35] shadow-xs ring-2 ring-[#C58B5C]'
                        : isCurrent
                        ? 'bg-[#F4E8DE] text-[#243B35] border-[#C58B5C]'
                        : 'bg-white text-[#243B35] border-[#E4DED4] hover:bg-[#F6F3EE]'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBVIEW 3: CALENDAR GRID (7 columns starting Saturday) */}
        {subView === 'calendar' && (
          <div className="space-y-2">
            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {ARABIC_WEEKDAYS_SHORT.map((wd) => (
                <div key={wd} className="text-[11px] font-bold text-[#77766F] py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 p-1">
              {calendarGrid.map((cell, idx) => {
                const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                const isSelectedDay = cellDateStr === currentDateStr;
                const isTodayCell = cellDateStr === todayStr;

                return (
                  <button
                    key={`${cellDateStr}-${idx}`}
                    onClick={() => handlePickDay(cell.day, cell.month, cell.year)}
                    className={`h-9 text-xs font-bold rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                      !cell.isCurrentMonth
                        ? 'opacity-30 border-transparent text-[#77766F] hover:opacity-60'
                        : isSelectedDay
                        ? 'bg-[#243B35] text-[#F6F3EE] border-[#243B35] shadow-xs ring-2 ring-[#C58B5C]'
                        : isTodayCell
                        ? 'bg-[#F4E8DE] text-[#243B35] border-[#C58B5C]'
                        : 'bg-white text-[#243B35] border-[#E4DED4] hover:bg-[#F6F3EE]'
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Jump Action Button */}
        <div className="mt-5 pt-3 border-t border-[#E4DED4] flex items-center justify-between gap-3">
          <button
            onClick={handleJumpToToday}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D8C3A5]" />
            <span>
              {mode === 'month'
                ? 'الشهر الحالي'
                : mode === 'week'
                ? 'الأسبوع الحالي'
                : 'النهارده'}
            </span>
          </button>

          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="py-2.5 px-4 rounded-xl bg-white border border-[#E4DED4] text-[#77766F] hover:text-[#243B35] text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
