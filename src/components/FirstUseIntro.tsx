import React, { useState } from 'react';
import { Sparkles, Calendar, PlusCircle, Check, Bell, BellOff, Volume2 } from 'lucide-react';
import { sound } from '../utils/audio';
import { ReminderEngine } from '../services/ReminderEngine';

interface FirstUseIntroProps {
  onDismiss: () => void;
  onOpenQuickAdd: () => void;
}

export const FirstUseIntro: React.FC<FirstUseIntroProps> = ({ onDismiss, onOpenQuickAdd }) => {
  const [permissionRequested, setPermissionRequested] = useState(false);

  const handleEnableNotifications = async () => {
    sound.playTap();
    setPermissionRequested(true);
    await ReminderEngine.requestNotificationPermission();
    onDismiss();
  };

  const handleLater = () => {
    sound.playTap();
    onDismiss();
  };

  return (
    <div
      role="region"
      aria-label="مقدمة سريعة عن ازبطها"
      className="mb-4 bg-white/95 border border-[#D8C3A5]/80 rounded-3xl p-4 sm:p-5 shadow-sm text-[#242522] relative overflow-hidden"
    >
      {/* Decorative Warm Ambient Glow */}
      <div
        className="absolute -top-12 -left-12 w-32 h-32 bg-[#D8C3A5]/25 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4">
        {/* Intro Text */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="ازبطها"
              className="w-8 h-8 rounded-xl object-contain shadow-xs"
            />
            <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
              عامل إيه؟ يلا نشوف وراك إيه النهارده.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-xl">
            <strong>ازبطها</strong> معمول عشان يبسطلك يومك بدون دوشة — يعرض مواعيدك في سريان زمني هادي ويجاوبك بوضوح على سؤال: <span className="text-[#243B35] font-semibold">إيه اللي ورايا؟</span>
          </p>

          {/* 3 Quick Visual Value Anchors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] sm:text-xs text-[#243B35]">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F6F3EE] border border-[#E4DED4]/60">
              <span className="w-2 h-2 rounded-full bg-[#6F8F78] shrink-0" />
              <span><strong>سريان الوقت:</strong> خطوة بخطوة</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F6F3EE] border border-[#E4DED4]/60">
              <Calendar className="w-3.5 h-3.5 text-[#C58B5C] shrink-0" />
              <span><strong>العدسة:</strong> اليوم والأسبوع والشهر</span>
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

        {/* Permission Request Step Banner */}
        <div className="p-3.5 rounded-2xl bg-[#F0EBE1] border border-[#D8C3A5] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#243B35] text-[#D8C3A5] flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-[#243B35]">
                عاوزين نبعتلك تنبيهات لمواعيدك ومهامك 🔔
              </h4>
              <p className="text-[11px] text-[#77766F] leading-snug">
                عشان متفوتش أي محاضرة أو ميتينج ومتحتاجش تفضل فاكر في دماغك.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleLater}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#77766F] hover:text-[#243B35] hover:bg-black/5 transition-colors cursor-pointer"
            >
              بعدين
            </button>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-4 py-1.5 rounded-xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] active:scale-95 transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تمام، فعّل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
