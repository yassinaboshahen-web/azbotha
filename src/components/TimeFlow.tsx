import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../types';
import { formatTime12h, getEventStatus, timeStringToMinutes, getCurrentTimeMinutes } from '../utils/dateUtils';
import { Check, Clock, MapPin, User, ChevronLeft } from 'lucide-react';
import { sound } from '../utils/audio';
import { EmptyState } from './EmptyState';

interface TimeFlowProps {
  events: CalendarEvent[];
  selectedDate: string;
  isToday: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
  onToggleEventComplete: (eventId: string, e?: React.MouseEvent) => void;
  onQuickAddEvent: () => void;
}

export const TimeFlow: React.FC<TimeFlowProps> = ({
  events,
  selectedDate,
  isToday,
  onSelectEvent,
  onToggleEventComplete,
  onQuickAddEvent,
}) => {
  const [, setCurrentMinutes] = useState<number>(getCurrentTimeMinutes());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinutes(getCurrentTimeMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sort events chronologically by start time
  const sortedEvents = [...events].sort(
    (a, b) => timeStringToMinutes(a.time) - timeStringToMinutes(b.time)
  );

  const formatCurrentBrowserTime = () => {
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    return formatTime12h(`${h}:${m}`);
  };

  if (sortedEvents.length === 0) {
    return (
      <div className="py-2 px-2 sm:px-4 max-w-3xl mx-auto">
        <EmptyState
          type="no-events"
          customTitle="يومك لسه فاضي."
          customSubtitle="ضيف أول حاجة وراك وشوف سريان يومك بيترتب قدامك في ثواني 🍃"
          actionLabel="+ وراك إيه؟"
          onAction={onQuickAddEvent}
        />
      </div>
    );
  }

  // Find if there's a next upcoming event
  const nextEventIndex = sortedEvents.findIndex((evt) => {
    const status = getEventStatus(evt.date, evt.time, evt.endTime, evt.completed);
    return status === 'next';
  });

  return (
    <div className="relative py-4 px-2 sm:px-4 max-w-3xl mx-auto">
      {/* TimeFlow Header */}
      <div className="flex items-center justify-between mb-6 px-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#243B35]" />
          <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
            سريان الوقت · TimeFlow
          </h2>
        </div>
        <span className="text-xs font-medium text-[#77766F]">
          {sortedEvents.filter((e) => e.completed).length} من {sortedEvents.length} خلصوا
        </span>
      </div>

      {/* Main Timeline Rail Container */}
      <div className="relative pr-8 sm:pr-12 pl-2">
        {/* Continuous Vertical Timeline Rail Line */}
        <div
          className="absolute right-3.5 sm:right-5 top-3 bottom-6 w-[2px] bg-gradient-to-b from-[#243B35] via-[#D8C3A5] to-[#E4DED4]"
          aria-hidden="true"
        />

        {/* List of Events */}
        <div className="space-y-4 sm:space-y-5">
          {sortedEvents.map((event, index) => {
            const status = isToday
              ? getEventStatus(event.date, event.time, event.endTime, event.completed)
              : event.completed
              ? 'past'
              : 'later';

            const isCurrent = status === 'current';
            const isPast = status === 'past' || event.completed;
            const isNext = status === 'next' || (isToday && index === nextEventIndex);

            // Determine node style
            let nodeBg = 'bg-[#F6F3EE] border-[#CEC4B5] text-[#77766F]';
            if (isPast) {
              nodeBg = 'bg-[#6F8F78] border-[#6F8F78] text-white';
            } else if (isCurrent) {
              nodeBg = 'bg-[#243B35] border-[#C58B5C] text-[#D8C3A5] shadow-md ring-4 ring-[#C58B5C]/20';
            } else if (isNext) {
              nodeBg = 'bg-[#C58B5C] border-[#C58B5C] text-white';
            }

            return (
              <div key={event.id} className="relative group">
                {/* Node on the rail */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    sound.playCheck();
                    onToggleEventComplete(event.id, e);
                  }}
                  aria-label={event.completed ? 'تعليم كغير منجز' : 'تعليم كمنجز'}
                  title={event.completed ? 'خلص خلاص (اضغط للإلغاء)' : 'اضغط للتعليم كمنجز'}
                  className={`absolute -right-[23px] sm:-right-[29px] top-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-transform duration-200 z-10 hover:scale-110 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none ${nodeBg}`}
                >
                  {event.completed ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C58B5C] animate-ping" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  )}
                </button>

                {/* Event Content Card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    sound.playTap();
                    onSelectEvent(event);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      sound.playTap();
                      onSelectEvent(event);
                    }
                  }}
                  className={`p-4 sm:p-5 rounded-3xl border transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] focus-visible:outline-none ${
                    isCurrent
                      ? 'bg-white border-[#243B35] shadow-md ring-1 ring-[#243B35]/20 scale-[1.01]'
                      : isPast
                      ? 'bg-[#F6F3EE]/70 border-[#E4DED4] opacity-75 hover:opacity-100 hover:bg-white'
                      : isNext
                      ? 'bg-white border-[#C58B5C]/60 shadow-sm hover:shadow-md'
                      : 'bg-white/90 border-[#E4DED4] hover:bg-white hover:shadow-sm'
                  }`}
                >
                  {/* Top unboxed typographic kicker & time */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#77766F]">
                      <span className="font-semibold text-[#243B35]">
                        {event.categoryLabel}
                      </span>
                      {event.course && (
                        <>
                          <span aria-hidden="true" className="text-[#CEC4B5]">·</span>
                          <span className="text-[#55544E]">{event.course}</span>
                        </>
                      )}
                      {isCurrent && (
                        <>
                          <span aria-hidden="true" className="text-[#CEC4B5]">·</span>
                          <span className="text-[#243B35] font-bold inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#6F8F78] animate-pulse" />
                            دلوقتي
                          </span>
                        </>
                      )}
                      {isNext && !isCurrent && (
                        <>
                          <span aria-hidden="true" className="text-[#CEC4B5]">·</span>
                          <span className="text-[#C58B5C] font-semibold">
                            اللي جاي 👀
                          </span>
                        </>
                      )}
                      {isPast && !event.completed && (
                        <>
                          <span aria-hidden="true" className="text-[#CEC4B5]">·</span>
                          <span className="text-[#A3A198] text-[11px]">
                            (الميعاد عدى)
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-[#C58B5C]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime12h(event.time)}</span>
                      {event.endTime && (
                        <span className="text-[#A3A198] font-normal">
                          - {formatTime12h(event.endTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    className={`text-sm sm:text-base font-bold text-[#242522] mb-2 ${
                      event.completed ? 'line-through text-[#77766F]' : ''
                    }`}
                  >
                    {event.title}
                  </h3>

                  {/* Contextual metadata */}
                  {(event.location || event.instructor || event.notes) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#77766F]">
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#A3A198]" />
                          <span>{event.location}</span>
                        </span>
                      )}
                      {event.instructor && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#A3A198]" />
                          <span>{event.instructor}</span>
                        </span>
                      )}
                      {event.notes && (
                        <span className="text-[#A3A198] truncate max-w-xs">
                          · {event.notes}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer Hint */}
                  <div className="mt-3 pt-2 border-t border-[#E4DED4]/40 flex items-center justify-between text-[11px] text-[#A3A198]">
                    <span>
                      {event.completed
                        ? 'تم الحضور ✓'
                        : isCurrent
                        ? 'شغال حالياً'
                        : isPast
                        ? 'ميعاد سابق'
                        : 'ميعاد قادم'}
                    </span>
                    <span className="flex items-center gap-0.5 text-[#243B35] font-semibold group-hover:translate-x-[-2px] transition-transform">
                      <span>عرض التفاصيل</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live current time pill */}
      {isToday && (
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E4DED4]/50 border border-[#E4DED4] text-xs font-semibold text-[#77766F]">
            <span className="w-2 h-2 rounded-full bg-[#6F8F78] animate-pulse" />
            <span>الساعة دلوقتي {formatCurrentBrowserTime()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
