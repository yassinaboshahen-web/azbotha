import React, { useEffect, useState } from 'react';
import { NotificationItem } from '../types';
import { X, Bell, Check, Clock, Calendar, Volume2, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/audio';
import { EmptyState } from './EmptyState';
import { ReminderEngine } from '../services/ReminderEngine';

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onNotificationClick: (notif: NotificationItem) => void;
  onMarkAllRead: () => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({
  isOpen,
  onClose,
  notifications,
  onNotificationClick,
  onMarkAllRead,
}) => {
  const [permStatus, setPermStatus] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (isOpen) {
      setPermStatus(ReminderEngine.getNotificationPermissionStatus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRequestPermission = async () => {
    sound.playTap();
    const granted = await ReminderEngine.requestNotificationPermission();
    setPermStatus(granted ? 'granted' : ReminderEngine.getNotificationPermissionStatus());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative z-10 w-full sm:max-w-md bg-[#F6F3EE] rounded-t-3xl sm:rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#243B35] text-[#D8C3A5] flex items-center justify-center">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
              التنبيهات والملاحظات السريعة
            </h2>
          </div>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Browser Permission Banner (Opt-in) */}
        {permStatus !== 'granted' && permStatus !== 'unsupported' && (
          <div className="mb-4 p-3 rounded-2xl bg-[#EAF3EE] border border-[#C7E0D3] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Volume2 className="w-4 h-4 text-[#2E6B56] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#243B35] truncate">
                  تفعيل إشعارات المتصفح
                </p>
                <p className="text-[11px] text-[#77766F]">
                  لتصلك تذكيرات المواعيد والمهام في موعدها
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1.5 rounded-xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              تفعيل
            </button>
          </div>
        )}

        {permStatus === 'granted' && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-white/60 border border-[#E4DED4] flex items-center justify-between text-[11px] text-[#2E6B56] font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B56]" />
              إشعارات المتصفح مفعلة
            </span>
          </div>
        )}

        {/* Action: Mark All Read */}
        {notifications.some((n) => !n.read) && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => {
                sound.playTap();
                onMarkAllRead();
              }}
              className="text-xs font-semibold text-[#77766F] hover:text-[#243B35] transition-colors cursor-pointer"
            >
              تعليم الكل كمقروء
            </button>
          </div>
        )}

        {/* Notifications List or Empty State */}
        {notifications.length === 0 ? (
          <EmptyState
            type="no-notifications"
            customTitle="مفيش إشعارات جديدة."
            customSubtitle="دماغك رايقة وكل مواعيدك ومهامك متأمنة 😌"
            compact
          />
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif) => {
              const iconMap: Record<string, React.ReactNode> = {
                upcoming: <Clock className="w-4 h-4 text-[#C58B5C]" />,
                task: <Check className="w-4 h-4 text-[#243B35]" />,
                tomorrow: <Calendar className="w-4 h-4 text-[#6F8F78]" />,
                reminder: <Bell className="w-4 h-4 text-[#C59A55]" />,
                morning: <Clock className="w-4 h-4 text-[#C58B5C]" />,
                evening: <Calendar className="w-4 h-4 text-[#6F8F78]" />,
              };

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    sound.playTap();
                    onNotificationClick(notif);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    !notif.read
                      ? 'bg-white border-[#C58B5C]/50 shadow-xs ring-1 ring-[#C58B5C]/20'
                      : 'bg-white/60 border-[#E4DED4] opacity-80 hover:opacity-100 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-[#F6F3EE] flex items-center justify-center shrink-0 mt-0.5">
                      {iconMap[notif.type] || <Bell className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-[#243B35] truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-[#A3A198] shrink-0">
                          {notif.time}
                        </span>
                      </div>

                      <p className="text-xs text-[#77766F] leading-relaxed">
                        {notif.subtitle}
                      </p>

                      {notif.actionText && (
                        <span className="inline-block mt-2 text-[11px] font-semibold text-[#C58B5C] hover:underline">
                          {notif.actionText} ←
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
