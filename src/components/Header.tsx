import React from 'react';
import { Bell, Volume2, VolumeX, Sparkles, WifiOff } from 'lucide-react';
import { sound } from '../utils/audio';
import { SyncStatusBadge } from './SyncStatusBadge';
import { apiClient } from '../services/apiClient';

interface HeaderProps {
  unreadNotifsCount: number;
  onOpenNotifications: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isToday: boolean;
  onJumpToToday: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  unreadNotifsCount,
  onOpenNotifications,
  soundEnabled,
  onToggleSound,
  isToday,
  onJumpToToday,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#F6F3EE]/90 backdrop-blur-md border-b border-[#E4DED4] px-4 sm:px-8 py-3 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#243B35] flex items-center justify-center text-[#D8C3A5] font-bold text-sm shadow-xs select-none">
            ص
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#243B35]">
            ازبطها
            </span>
            {apiClient.isCloudSyncEnabled() && <SyncStatusBadge />}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isToday && (
            <button
              onClick={() => {
                sound.playTap();
                onJumpToToday();
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] transition-colors flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D8C3A5]" />
              <span className="hidden sm:inline">ارجع للنهارده</span>
              <span className="sm:hidden">اليوم</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleSound();
              sound.playTap();
            }}
            aria-label={soundEnabled ? 'كتم الصوت' : 'تفعيل المؤثرات الصوتية'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#E4DED4]/60 transition-colors active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
            title={soundEnabled ? 'المؤثرات الصوتية مفعلة' : 'المؤثرات الصوتية مكتومة'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 opacity-50" />
            )}
          </button>

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
