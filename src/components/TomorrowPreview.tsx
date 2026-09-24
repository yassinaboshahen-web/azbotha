import React from 'react';
import { ArrowLeft, Sparkles, Coffee } from 'lucide-react';
import { sound } from '../utils/audio';

interface TomorrowPreviewProps {
  tomorrowEventsCount: number;
  tomorrowTasksCount: number;
  onGoToTomorrow: () => void;
  isToday: boolean;
}

export const TomorrowPreview: React.FC<TomorrowPreviewProps> = ({
  tomorrowEventsCount,
  tomorrowTasksCount,
  onGoToTomorrow,
  isToday,
}) => {
  if (!isToday) return null;

  const totalTomorrow = tomorrowEventsCount + tomorrowTasksCount;

  return (
    <div className="mt-8 mb-12 px-3 sm:px-4 max-w-3xl mx-auto">
      <div className="bg-gradient-to-l from-[#243B35] to-[#2d4942] text-[#F6F3EE] rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden transition-transform duration-200 hover:shadow-lg">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#D8C3A5]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-[#D8C3A5]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#D8C3A5]">
                بكرة 👀
              </span>
            </div>
            {totalTomorrow > 0 ? (
              <>
                <h3 className="text-base sm:text-lg font-bold">
                  عندك {tomorrowEventsCount} مواعيد {tomorrowTasksCount > 0 ? `و ${tomorrowTasksCount} مهام` : ''}
                </h3>
                <p className="text-xs text-[#D8C3A5]/80 mt-0.5">
                  بص عليهم بنظرة سريعة قبل ما تنام ورتب أولوياتك.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>بكرة لسه فاضي ورايق ☕️</span>
                </h3>
                <p className="text-xs text-[#D8C3A5]/80 mt-0.5">
                  مفيش مواعيد متسجلة حتى الآن، تقدر ترتاح أو تخطط لبكرة.
                </p>
              </>
            )}
          </div>

          <button
            onClick={() => {
              sound.playTap();
              onGoToTomorrow();
            }}
            className="self-start sm:self-center px-4 py-2.5 rounded-2xl bg-[#D8C3A5] text-[#243B35] font-bold text-xs sm:text-sm hover:bg-[#ebdcc8] transition-colors flex items-center gap-2 shadow-sm shrink-0 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-white outline-none"
          >
            <span>{totalTomorrow > 0 ? 'بص على بكرة' : 'فتح جدول بكرة'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
