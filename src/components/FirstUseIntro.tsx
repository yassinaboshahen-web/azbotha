import React from 'react';
import { Sparkles, Calendar, PlusCircle, Check } from 'lucide-react';
import { sound } from '../utils/audio';
import { ReminderEngine } from '../services/ReminderEngine';

interface FirstUseIntroProps {
  onDismiss: () => void;
  onOpenQuickAdd: () => void;
}

export const FirstUseIntro: React.FC<FirstUseIntroProps> = ({ onDismiss, onOpenQuickAdd }) => {
  return (
    <div
      role="region"
      aria-label="مقدمة سريعة عن صاحب يومك"
      className="mb-4 bg-white/90 border border-[#D8C3A5]/70 rounded-3xl p-4 sm:p-5 shadow-sm text-[#242522] relative overflow-hidden"
    >
      {/* Decorative Warm Ambient Glow */}
      <div
        className="absolute -top-12 -left-12 w-32 h-32 bg-[#D8C3A5]/20 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Intro Text */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl" role="img" aria-label="تحية">👋</span>
            <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
              عامل إيه؟ يلا نشوف وراك إيه النهارده.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-xl">
            <strong>ازبطها</strong> معمول عشان يبسطلك يومك بدون دوشة — يعرض مواعيدك في سريان زمني هادي ويجاوبك بوضوح على سؤال: <span className="text-[#243B35] font-semibold">إيه اللي ورايا؟</span>
          </p>

          {/* 3 Quick Visual Value Anchors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] sm:text-xs text-[#243B35]">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F6F3EE] border border-[#E4DED4]/60">
              <span className="w-2 h-2 rounded-full bg-[#6F8F78] shrink-0" />
              <span><strong>سريان الوقت:</strong> يومك خطوة بخطوة</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F6F3EE] border border-[#E4DED4]/60">
              <Calendar className="w-3.5 h-3.5 text-[#C58B5C] shrink-0" />
              <span><strong>العدسة:</strong> اليوم، الأسبوع، والشهر</span>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playPop();
                onOpenQuickAdd();
              }}
              className="flex items-center gap-2 p-2 rounded-xl bg-[#F6F3EE] border border-[#D8C3A5] hover:bg-[#F2ECE1] transition-colors cursor-pointer text-start"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#243B35] shrink-0" />
              <span><strong>+ وراك إيه؟:</strong> ضيف معاد أو مهمة</span>
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              ReminderEngine.requestNotificationPermission();
              onDismiss();
            }}
            className="px-4 py-2 rounded-2xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] active:scale-95 transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
            aria-label="إغلاق المقدمة والبدء في الاستخدام"
          >
            <Check className="w-3.5 h-3.5" />
            <span>تمام، يلا بينا</span>
          </button>
        </div>
      </div>
    </div>
  );
};
