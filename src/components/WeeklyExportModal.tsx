import React, { useState, useEffect } from 'react';
import { X, Share2, Check, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';
import { ReportMetrics, formatReportSummaryText } from '../utils/reportUtils';
import { formatTime12h } from '../utils/dateUtils';

interface WeeklyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: ReportMetrics;
  periodName: string;
  weekDays?: {
    date: string;
    dayName: string;
    dayNumber: number;
    events: any[];
    tasks: any[];
  }[];
}

export const WeeklyExportModal: React.FC<WeeklyExportModalProps> = ({
  isOpen,
  onClose,
  metrics,
  periodName,
  weekDays,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    sound.playPop();
    const textSummary = formatReportSummaryText(metrics, periodName);
    
    // If weekDays is provided, we can add a bit more detail
    let detailedText = textSummary;
    if (weekDays && weekDays.length > 0) {
        detailedText += '\n\n📌 تفاصيل سريعة:\n';
        weekDays.forEach(day => {
            if (day.events.length > 0) {
                detailedText += `• ${day.dayName}: ${day.events.length} مواعيد\n`;
            }
        });
    }

    navigator.clipboard.writeText(detailedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-[#F6F3EE] rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C58B5C]" />
            <h2 className="text-lg sm:text-xl font-bold text-[#243B35]">
              ملخص {periodName} · خريطة يومك
            </h2>
          </div>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable/Export Poster Card */}
        <div className="bg-white rounded-3xl border-2 border-[#243B35]/20 p-6 sm:p-8 shadow-sm space-y-6 text-[#242522]">
          {/* Poster Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#E4DED4] pb-4 gap-2">
            <div>
              <div className="text-xs font-bold text-[#C58B5C] uppercase tracking-wider mb-1">
                 ازبطها · {periodName === 'الأسبوع ده' ? 'Weekly' : 'Monthly'} Summary
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#243B35]">
                {metrics.completionRate > 70 ? 'أداء ممتاز يا بطل! 🚀' : 'أسبوع هادي ومنظم 🌿'}
              </h3>
            </div>
            <div className="text-xs text-[#77766F] font-semibold text-left">
              {metrics.totalEvents} مواعيد · {metrics.completedTasks + metrics.completedEvents} عناصر منجزة
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-3 bg-[#F6F3EE] rounded-2xl border border-[#E4DED4] text-center">
                 <div className="text-[10px] font-bold text-[#77766F] mb-1">نسبة الإنجاز</div>
                 <div className="text-2xl font-bold text-[#243B35]">{metrics.completionRate}%</div>
             </div>
             <div className="p-3 bg-[#F6F3EE] rounded-2xl border border-[#E4DED4] text-center">
                 <div className="text-[10px] font-bold text-[#77766F] mb-1">المواعيد</div>
                 <div className="text-2xl font-bold text-[#243B35]">{metrics.totalEvents}</div>
             </div>
             <div className="p-3 bg-[#F6F3EE] rounded-2xl border border-[#E4DED4] text-center">
                 <div className="text-[10px] font-bold text-[#77766F] mb-1">المهام</div>
                 <div className="text-2xl font-bold text-[#243B35]">{metrics.totalTasks}</div>
             </div>
             <div className="p-3 bg-[#F6F3EE] rounded-2xl border border-[#E4DED4] text-center">
                 <div className="text-[10px] font-bold text-[#77766F] mb-1">متأخر</div>
                 <div className="text-2xl font-bold text-[#B86B61]">{metrics.overdueTasksCount}</div>
             </div>
          </div>

          {/* 7 Days Editorial Stack (only if weekDays provided) */}
          {weekDays && weekDays.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekDays.map((day) => (
                <div
                    key={day.date}
                    className="bg-[#F6F3EE]/60 rounded-2xl p-3.5 border border-[#E4DED4]"
                >
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#243B35]">
                        {day.dayName} {day.dayNumber}
                    </span>
                    <span className="text-[11px] text-[#77766F]">
                        {day.events.length} مواعيد
                    </span>
                    </div>

                    {day.events.length === 0 ? (
                    <p className="text-[11px] text-[#A3A198] italic py-1">
                        يوم رايق ومفيهوش ارتباطات
                    </p>
                    ) : (
                    <div className="space-y-1.5">
                        {day.events.slice(0, 3).map((evt) => (
                        <div
                            key={evt.id}
                            className="text-xs flex items-center justify-between gap-1 text-[#242522]"
                        >
                            <span className="font-medium truncate">{evt.title}</span>
                            <span className="text-[10px] font-bold text-[#C58B5C] tabular-nums shrink-0">
                            {formatTime12h(evt.time)}
                            </span>
                        </div>
                        ))}
                        {day.events.length > 3 && <div className="text-[9px] text-[#77766F] text-left">+{day.events.length - 3} عناصر أخرى</div>}
                    </div>
                    )}
                </div>
                ))}
            </div>
          )}

          {/* Poster Footer Note */}
          <div className="pt-3 border-t border-[#E4DED4] flex items-center justify-between text-[11px] text-[#77766F]">
            <span>تم الإنشاء عبر صاحب يومك · بص كده على يومك</span>
            <span>{new Date().toLocaleDateString('ar-EG')}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            onClick={handleCopySummary}
            className="px-5 py-2.5 rounded-xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] transition-colors flex items-center gap-2 shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#6F8F78]" />
                <span>تم نسخ الملخص!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-[#D8C3A5]" />
                <span>نسخ ملخص {periodName} للمشاركة</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

