import React, { useEffect, useState } from 'react';
import { NotificationItem } from '../types';
import {
  X,
  Bell,
  Check,
  Clock,
  Calendar,
  Volume2,
  ShieldCheck,
  AlertTriangle,
  Settings,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [exactAlarmStatus, setExactAlarmStatus] = useState<'granted' | 'denied' | 'unsupported'>('granted');
  const [showBatteryHelp, setShowBatteryHelp] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [testNotificationState, setTestNotificationState] = useState<{
    status: 'idle' | 'scheduling' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const testTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPermissions = async () => {
    const [pStatus, eStatus] = await Promise.all([
      ReminderEngine.getNotificationPermissionStatus(),
      ReminderEngine.getExactAlarmStatus(),
    ]);
    setPermStatus(pStatus);
    setExactAlarmStatus(eStatus);
  };

  const handleRunDiagnostics = async () => {
    sound.playPop();
    setIsRunningDiag(true);
    try {
      const report = await ReminderEngine.runNotificationDiagnostics();
      setDiagnosticReport(report);
    } catch (err: any) {
      setDiagnosticReport({ error: err?.message || String(err) });
    } finally {
      setIsRunningDiag(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshPermissions();
      setTestNotificationState({ status: 'idle' });
    }
    return () => {
      if (testTimerRef.current) {
        clearTimeout(testTimerRef.current);
        testTimerRef.current = null;
      }
    };
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
    await ReminderEngine.requestNotificationPermission();
    await refreshPermissions();
  };

  const handleFixExactAlarm = async () => {
    sound.playTap();
    await ReminderEngine.changeExactNotificationSetting();
    await refreshPermissions();
  };

  const handleTestNotification = async () => {
    sound.playPop();
    setTestNotificationState({ status: 'scheduling' });
    if (testTimerRef.current) clearTimeout(testTimerRef.current);

    const result = await ReminderEngine.scheduleTestNotification(10);
    if (result.success) {
      setTestNotificationState({
        status: 'success',
        message: 'تم جدولة إشعار تجريبي بعد 10 ثوانٍ! اخرج من التطبيق أو اقفل الشاشة لتجربته 🔔',
      });
      testTimerRef.current = setTimeout(() => {
        setTestNotificationState({ status: 'idle' });
        testTimerRef.current = null;
      }, 9000);
    } else {
      setTestNotificationState({
        status: 'error',
        message: result.error || 'تعذر جدولة الإشعار التجريبي. اتأكد من تفعيل الأذونات.',
      });
    }
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
      <div className="relative z-10 w-full sm:max-w-lg bg-[#F6F3EE] rounded-t-3xl sm:rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#243B35] text-[#D8C3A5] flex items-center justify-center shadow-xs">
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
            aria-label="إغلاق التنبيهات"
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Notifications Denied / Prompt Persistent Banner */}
        {permStatus === 'denied' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#FFF3ED] border border-[#F4C4B4] space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#B86B61] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#8C3A30]">
                  إذن الإشعارات غير مفعّل على جهازك
                </p>
                <p className="text-[11px] text-[#77766F] leading-relaxed mt-0.5">
                  لتفعيل التنبيهات: افتح <strong>إعدادات الهاتف</strong> &gt; <strong>التطبيقات</strong> &gt; <strong>ازبطها</strong> &gt; <strong>الإشعارات</strong> واختر <strong>سماح</strong>.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleRequestPermission}
                className="px-3 py-1.5 rounded-xl bg-[#8C3A30] text-white text-xs font-bold hover:bg-[#722e26] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                إعادة طلب الإذن
              </button>
            </div>
          </div>
        )}

        {permStatus === 'prompt' && (
          <div className="mb-4 p-3 rounded-2xl bg-[#EAF3EE] border border-[#C7E0D3] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Volume2 className="w-4 h-4 text-[#2E6B56] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#243B35] truncate">
                  تفعيل التنبيهات الصوتية والإشعارات
                </p>
                <p className="text-[11px] text-[#77766F]">
                  لتصلك تذكيرات المواعيد والمهام بدقة
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

        {/* 2. Exact Alarm Missing Banner (Android 12+) */}
        {permStatus === 'granted' && exactAlarmStatus === 'denied' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#FFF8E7] border border-[#E8D4A2] space-y-2">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#C58B5C] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#243B35]">
                  إذن المنبّه الدقيق غير مفعّل (أندرويد 12+)
                </p>
                <p className="text-[11px] text-[#77766F] leading-relaxed mt-0.5">
                  التنبيهات شغالة بس ممكن تتأخر شوية بسبب توفير الطاقة في أندرويد. عشان ترن في الدقيقة بالظبط، اسمح بإذن المنبّه.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleFixExactAlarm}
                className="px-3 py-1.5 rounded-xl bg-[#C58B5C] text-white text-xs font-bold hover:bg-[#b0784a] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                تفعيل المنبّه الدقيق
              </button>
            </div>
          </div>
        )}

        {/* 3. Action Tools: Test Notification, Diagnostics & Battery Help */}
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Test Notification Button */}
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testNotificationState.status === 'scheduling'}
              className="p-2.5 rounded-2xl bg-white border border-[#E4DED4] hover:border-[#243B35] hover:bg-[#F2ECE1] transition-all flex items-center justify-between gap-2 text-start cursor-pointer shadow-xs group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#243B35]/10 text-[#243B35] flex items-center justify-center shrink-0">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#243B35] block truncate">
                    جرّب التنبيه دلوقتي
                  </span>
                  <span className="text-[10px] text-[#77766F] block truncate">
                    تنبيه تجريبي بعد 10 ثوانٍ
                  </span>
                </div>
              </div>
              <Zap className="w-3.5 h-3.5 text-[#C58B5C] group-hover:scale-110 transition-transform shrink-0" />
            </button>

            {/* Battery Help Toggle */}
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setShowBatteryHelp(!showBatteryHelp);
              }}
              className="p-2.5 rounded-2xl bg-white border border-[#E4DED4] hover:border-[#243B35] hover:bg-[#F2ECE1] transition-all flex items-center justify-between gap-2 text-start cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#6F8F78]/15 text-[#2E6B56] flex items-center justify-center shrink-0">
                  <BatteryCharging className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#243B35] block truncate">
                    لو التنبيهات بتتأخر؟
                  </span>
                  <span className="text-[10px] text-[#77766F] block truncate">
                    حلول توفير بطارية شاومي وسامسونج
                  </span>
                </div>
              </div>
              {showBatteryHelp ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#77766F] shrink-0" />
              )}
            </button>
          </div>

          {/* Diagnostic Check Button */}
          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={isRunningDiag}
            className="w-full p-2.5 rounded-2xl bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] transition-all flex items-center justify-center gap-2 text-xs font-bold cursor-pointer shadow-xs active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#D8C3A5]" />
            <span>{isRunningDiag ? 'جاري تشخيص نظام التنبيهات...' : 'تشخيص نظام التنبيهات الشامل (Realme / Android Diagnostics)'}</span>
          </button>
        </div>

        {/* Diagnostic Report Output */}
        {diagnosticReport && (
          <div className="mb-4 p-3.5 rounded-2xl bg-white border border-[#243B35]/30 space-y-2 text-xs font-mono text-[#243B35] animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#E4DED4] pb-1.5 font-bold">
              <span>🔬 تقرير تشخيص الإشعارات</span>
              <button onClick={() => setDiagnosticReport(null)} className="text-[10px] text-red-600 cursor-pointer">إغلاق</button>
            </div>
            {diagnosticReport.error ? (
              <p className="text-red-600">خطأ في التشخيص: {diagnosticReport.error}</p>
            ) : (
              <div className="space-y-1 text-[11px] text-[#333]">
                <p>• إذن الإشعارات (POST_NOTIFICATIONS): <strong>{String(diagnosticReport.checkPermissionsResult?.display || diagnosticReport.checkPermissionsResult?.error)}</strong></p>
                <p>• طلب الإذن (Request): <strong>{String(diagnosticReport.requestPermissionsResult?.display || diagnosticReport.requestPermissionsResult?.error)}</strong></p>
                <p>• المنبّه الدقيق (Exact Alarm): <strong>{String(diagnosticReport.exactAlarmResult?.exact_alarm || diagnosticReport.exactAlarmResult?.error)}</strong></p>
                <p>• إنشاء القناة (Channel): <strong>{diagnosticReport.channelCreated ? 'تم بنجاح (High Importance)' : 'فشل'}</strong></p>
                <p>• التنبيهات المنتظرة (Pending): <strong>{diagnosticReport.pendingCount}</strong></p>
                {diagnosticReport.pendingCount > 0 && (
                  <div className="bg-[#F6F3EE] p-1.5 rounded max-h-24 overflow-y-auto text-[10px]">
                    {JSON.stringify(diagnosticReport.pendingNotifications, null, 2)}
                  </div>
                )}
                <p>• جدولة التنبيه التجريبي: <strong>{diagnosticReport.testScheduleResult?.success ? `نجح (ID: ${diagnosticReport.testScheduleResult.notificationId})` : `فشل: ${diagnosticReport.testScheduleResult?.error}`}</strong></p>
              </div>
            )}
          </div>
        )}

        {/* Test Notification Feedback Message */}
        {testNotificationState.status === 'success' && (
          <div className="mb-4 p-3 rounded-2xl bg-[#EAF3EE] border border-[#2E6B56]/30 text-xs text-[#2E6B56] font-medium flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 shrink-0" />
            <span>{testNotificationState.message}</span>
          </div>
        )}

        {testNotificationState.status === 'error' && (
          <div className="mb-4 p-3 rounded-2xl bg-[#FFF3ED] border border-[#B86B61]/30 text-xs text-[#8C3A30] font-medium flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{testNotificationState.message}</span>
          </div>
        )}

        {/* 4. Battery Optimization Guidance Accordion */}
        {showBatteryHelp && (
          <div className="mb-4 p-4 rounded-2xl bg-white border border-[#D8C3A5] space-y-3 text-[#242522] animate-fadeIn text-xs leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-[#243B35] border-b border-[#E4DED4] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#2E6B56]" />
              <span>دليل استثناء التطبيق من توفير البطارية الصارم:</span>
            </div>

            <div className="space-y-2.5 text-[11px]">
              <div>
                <strong className="text-[#243B35] block mb-0.5">🔹 شاومي / بوكو / ريدمي (Xiaomi / MIUI / HyperOS):</strong>
                <p className="text-[#77766F]">
                  اضغط مطولاً على أيقونة ازبطها &gt; معلومات التطبيق &gt; فعّل <strong>التشغيل التلقائي (Autostart)</strong>، ومن <strong>موفر البطارية</strong> اختر <strong>بلا قيود (No restrictions)</strong>.
                </p>
              </div>

              <div>
                <strong className="text-[#243B35] block mb-0.5">🔹 سامسونج (Samsung OneUI):</strong>
                <p className="text-[#77766F]">
                  الضبط &gt; التطبيقات &gt; ازبطها &gt; البطارية &gt; اختر <strong>غير مقيد (Unrestricted)</strong> عشان النظام ميموتش التنبيهات في الخلفية.
                </p>
              </div>

              <div>
                <strong className="text-[#243B35] block mb-0.5">🔹 أوبو / ريلمي (Oppo / Realme / ColorOS):</strong>
                <p className="text-[#77766F]">
                  معلومات التطبيق &gt; استخدام البطارية &gt; السماح بالنشاط في الخلفية والسماح بالبدء التلقائي.
                </p>
              </div>

              <div>
                <strong className="text-[#243B35] block mb-0.5">🔹 هواوي (Huawei):</strong>
                <p className="text-[#77766F]">
                  الإعدادات &gt; البطارية &gt; تشغيل التطبيقات &gt; ازبطها &gt; حوّلها إلى إدارة يدوية (فعّل التشغيل في الخلفية).
                </p>
              </div>
            </div>
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
