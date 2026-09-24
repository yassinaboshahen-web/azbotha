import React from 'react';
import { TemporalZoomLevel } from '../types';
import { sound } from '../utils/audio';
import { Calendar as CalendarIcon, Clock, Grid } from 'lucide-react';

interface TemporalLensProps {
  currentLevel: TemporalZoomLevel;
  onChange: (level: TemporalZoomLevel) => void;
}

export const TemporalLens: React.FC<TemporalLensProps> = ({ currentLevel, onChange }) => {
  const levels: { id: TemporalZoomLevel; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'day', label: 'اليوم', icon: <Clock className="w-3.5 h-3.5" />, desc: 'تفاصيل اليوم خطوة بخطوة' },
    { id: 'week', label: 'الأسبوع', icon: <CalendarIcon className="w-3.5 h-3.5" />, desc: 'نظرة عامة على الـ 7 أيام' },
    { id: 'month', label: 'الشهر', icon: <Grid className="w-3.5 h-3.5" />, desc: 'خريطة الشهر والضغط' },
  ];

  return (
    <div className="flex items-center justify-center my-4 px-4">
      <div
        role="tablist"
        aria-label="العدسة الزمنية للتقويم"
        className="bg-[#E4DED4]/70 p-1 rounded-2xl flex items-center gap-1 shadow-inner border border-[#E4DED4]"
      >
        {levels.map((lvl) => {
          const isActive = currentLevel === lvl.id;
          return (
            <button
              key={lvl.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`${lvl.label} - ${lvl.desc}`}
              onClick={() => {
                if (currentLevel !== lvl.id) {
                  sound.playTap();
                  onChange(lvl.id);
                }
              }}
              className={`relative px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none ${
                isActive
                  ? 'bg-[#243B35] text-[#F6F3EE] shadow-sm'
                  : 'text-[#77766F] hover:text-[#243B35] hover:bg-[#E4DED4]/50'
              }`}
            >
              <span className={isActive ? 'text-[#D8C3A5]' : 'text-[#77766F]'}>
                {lvl.icon}
              </span>
              <span>{lvl.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
