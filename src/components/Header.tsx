import React from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';
import { SyncStatusBadge } from './SyncStatusBadge';

interface HeaderProps {
  unreadNotifsCount: number;
  onOpenNotifications: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  isToday?: boolean;
  onJumpToToday?: () => void;
  periodType?: 'day' | 'week' | 'month';
  isCurrentPeriod?: boolean;
  onJumpToCurrent?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  unreadNotifsCount,
  onOpenNotifications,
  isToday = true,
  onJumpToToday,
  periodType = 'day',
  isCurrentPeriod,
  onJumpToCurrent,
}) => {
  const isCurrent = isCurrentPeriod !== undefined ? isCurrentPeriod : isToday;
  const jumpHandler = onJumpToCurrent || onJumpToToday;

  return (
    <header className="sticky top-0 z-30 bg-[#F6F3EE]/90 backdrop-blur-md border-b border-[#E4DED4] px-4 sm:px-8 py-3 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isCurrent && jumpHandler && (
            <button
              onClick={() => {
                sound.playTap();
                jumpHandler();
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] transition-colors flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D8C3A5]" />
              {periodType === 'month' ? (
                <>
                  <span className="hidden sm:inline">ارجع للشهر ده</span>
                  <span className="sm:hidden">الشهر ده</span>
                </>
              ) : periodType === 'week' ? (
                <>
                  <span className="hidden sm:inline">ارجع للأسبوع ده</span>
                  <span className="sm:hidden">الأسبوع ده</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">ارجع للنهارده</span>
                  <span className="sm:hidden">اليوم</span>
                </>
              )}
            </button>
          )}

          {/* Contextual Notification Trigger */}
          <button
            onClick={() => {
              sound.playPop();
              onOpenNotifications();
            }}
            aria-label="التنبيهات والملاحظات"
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-[#243B35] hover:bg-[#E4DED4]/60 transition-colors active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#C58B5C] ring-2 ring-[#F6F3EE] animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
