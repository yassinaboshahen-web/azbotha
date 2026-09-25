import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Upload, Check, AlertTriangle, FileJson, History } from 'lucide-react';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { syncService } from '../services/syncService';
import { sound } from '../utils/audio';

interface LocalBackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported?: () => void;
}

export const LocalBackupRestoreModal: React.FC<LocalBackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataImported,
}) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [snapshots, setSnapshots] = useState<{ key: string; timestamp: string; count: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSnapshots() {
      const { snapshotService } = await import('../services/snapshotService');
      const list = await snapshotService.listSnapshots();
      setSnapshots(list);
    }
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const playTap = () => {
    try {
      sound.playTap();
    } catch {
      // Ignore
    }
  };

  const playPop = () => {
    try {
      sound.playPop();
    } catch {
      // Ignore
    }
  };

  const handleRestoreFromSnapshot = async (key: string) => {
    playTap();
    if (!window.confirm('هل أنت متأكد إنك عاوز تسترجع البيانات من النسخة دي؟ هيتم حفظ نسخة الحالية كاحتياطية أولاً.')) {
      return;
    }
    setImporting(true);
    setStatus(null);
    try {
      const { snapshotService } = await import('../services/snapshotService');
      const ok = await snapshotService.restoreFromSnapshot(key);
      if (ok) {
        setStatus({
          type: 'success',
          message: 'حمد لله على السلامة! تم استرجاع البيانات بنجاح من النسخة التلقائية.',
        });
        playPop();
        const list = await snapshotService.listSnapshots();
        setSnapshots(list);
        if (onDataImported) onDataImported();
      } else {
        throw new Error('فشل استرجاع النسخة التلقائية.');
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'حصل خطأ وأحنا بنسترجع النسخة التلقائية.',
      });
    } finally {
      setImporting(false);
    }
  };

  // --- Export Local Backup ---
  const handleExport = async () => {
    playTap();
    setExporting(true);
    setStatus(null);

    try {
      const [tasks, events, thoughts, prefs] = await Promise.all([
        indexedDBRepository.getAllTasks(),
        indexedDBRepository.getAllEvents(),
        indexedDBRepository.getAllReminders(),
        indexedDBRepository.getPreferences(),
      ]);

      const backupObj = {
        app: 'daycompanion',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          tasks: tasks || [],
          events: events || [],
          thoughts: thoughts || [],
          preferences: prefs || {},
        },
      };

      const jsonString = JSON.stringify(backupObj, null, 2);
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        const fileName = `daycompanion_backup_${new Date().toISOString().split('T')[0]}.json`;
        const result = await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
        });
        
        try {
          await Share.share({
              title: 'نسخة احتياطية لازبطها',
              text: 'نسخة احتياطية من بيانات صاحب يومك',
              files: [result.uri],
              dialogTitle: 'احفظ النسخة الاحتياطية'
          });
          // Only update metadata if share was likely successful (didn't throw/cancel usually)
          await indexedDBRepository.setMetadata('lastBackupAt', new Date().toISOString());
        } catch (shareErr) {
          // If user cancels, we just catch and don't update metadata or show success
          console.log('User cancelled share or share failed', shareErr);
          setExporting(false);
          return;
        }
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
  
        const a = document.createElement('a');
        a.href = url;
        a.download = `daycompanion_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await indexedDBRepository.setMetadata('lastBackupAt', new Date().toISOString());
      }

      setStatus({
        type: 'success',
        message: 'تم حفظ النسخة الاحتياطية بنجاح! تقدر تستخدمها في أي وقت.',
      });
      playPop();
    } catch (err) {
      console.error(err);
      setStatus({
        type: 'error',
        message: 'حصلت مشكلة وأحنا بنعمل النسخة الاحتياطية. جرب تاني كده.',
      });
    } finally {
      setExporting(false);
    }
  };

  // --- Validate and Import Backup ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playTap();
    setImporting(true);
    setStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const backup = JSON.parse(text);

        // 1. Basic Structure Validation
        if (!backup || typeof backup !== 'object') {
          throw new Error('الملف ده تالف أو مش مكتوب صح.');
        }

        if (backup.app !== 'daycompanion') {
          throw new Error('الملف ده مش تبع برنامج " ازبطها".');
        }

        if (typeof backup.version !== 'number' || backup.version > 1) {
          throw new Error('إصدار النسخة الاحتياطية دي مش معروف أو غير مدعوم حالياً.');
        }

        if (!backup.data || typeof backup.data !== 'object') {
          throw new Error('مفيش بيانات سليمة جوه الملف ده.');
        }

        const { tasks, events, thoughts, preferences } = backup.data;

        // 2. Tasks Array & Fields Validation
        if (tasks !== undefined) {
          if (!Array.isArray(tasks)) {
            throw new Error('بيانات المهام جوه الملف مش سليمة.');
          }
          for (const t of tasks) {
            if (!t.id || typeof t.id !== 'string') throw new Error('لقينا مهمة من غير كود تعريف سليم.');
            if (!t.title || typeof t.title !== 'string') throw new Error('لقينا مهمة من غير عنوان.');
          }
        }

        // 3. Events Array & Fields Validation
        if (events !== undefined) {
          if (!Array.isArray(events)) {
            throw new Error('بيانات المواعيد جوه الملف مش سليمة.');
          }
          for (const ev of events) {
            if (!ev.id || typeof ev.id !== 'string') throw new Error('لقينا موعد من غير كود تعريف سليم.');
            if (!ev.title || typeof ev.title !== 'string') throw new Error('لقينا موعد من غير عنوان.');
            if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
              throw new Error(`تاريخ الموعد "${ev.title}" مش مكتوب بشكل سليم.`);
            }
          }
        }

        // 4. Thoughts Array Validation
        if (thoughts !== undefined) {
          if (!Array.isArray(thoughts)) {
            throw new Error('بيانات التذكيرات السريعة مش سليمة.');
          }
          for (const th of thoughts) {
            if (!th.id || typeof th.id !== 'string') throw new Error('لقينا تذكير من غير كود تعريف سليم.');
          }
        }

        // 5. Capture a snapshot of current data BEFORE restore to prevent any possible data loss
        const { snapshotService } = await import('../services/snapshotService');
        await snapshotService.captureSnapshot().catch(() => {});

        // 6. Apply Restore to IndexedDB safely (Upsert Behavior)
        let restoredTasksCount = 0;
        let restoredEventsCount = 0;
        let restoredThoughtsCount = 0;

        if (tasks && tasks.length > 0) {
          for (const t of tasks) {
            await indexedDBRepository.saveTask(t);
            // Queue sync for restored item so it reflects on cloud if connected
            await indexedDBRepository.enqueueSyncOp({
              entityType: 'task',
              action: 'create',
              entityId: t.id,
              payload: t,
            });
            restoredTasksCount++;
          }
        }

        if (events && events.length > 0) {
          for (const ev of events) {
            await indexedDBRepository.saveEvent(ev);
            await indexedDBRepository.enqueueSyncOp({
              entityType: 'event',
              action: 'create',
              entityId: ev.id,
              payload: ev,
            });
            restoredEventsCount++;
          }
        }

        if (thoughts && thoughts.length > 0) {
          for (const th of thoughts) {
            await indexedDBRepository.saveReminder(th);
            await indexedDBRepository.enqueueSyncOp({
              entityType: 'reminder',
              action: 'create',
              entityId: th.id,
              payload: {
                id: th.id,
                title: th.title || th.text || '',
                text: th.text || th.title || '',
                scheduled_for: th.scheduled_for,
                date: th.date,
                status: th.status || 'pending',
                type: th.type || 'custom',
                pinned: Boolean(th.pinned),
                trigger_configuration: th,
              },
            });
            restoredThoughtsCount++;
          }
        }

        if (preferences && typeof preferences === 'object' && Object.keys(preferences).length > 0) {
          await indexedDBRepository.savePreferences(preferences);
        }

        setStatus({
          type: 'success',
          message: `حمد لله على السلامة! تم استرجاع ${restoredEventsCount} مواعيد و ${restoredTasksCount} مهام بنجاح من ملف النسخة الاحتياطية.`,
        });
        playPop();

        // Trigger UI updates
        if (onDataImported) {
          onDataImported();
        }

        // Trigger background sync attempt
        syncService.flushSyncQueue().catch(() => {});
      } catch (err: any) {
        setStatus({
          type: 'error',
          message: err.message || 'فشل استرجاع الملف. اتأكد إنه ملف نسخة احتياطية سليم.',
        });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setStatus({
        type: 'error',
        message: 'حصلت مشكلة وأحنا بنقرا الملف من جهازك. جرب تاني.',
      });
      setImporting(false);
    };

    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    playTap();
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-[#F6F3EE] rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-6 text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E4DED4]">
          <h3 className="text-base sm:text-lg font-bold text-[#243B35]">
            النسخ الاحتياطي والاسترجاع المحلي 💾
          </h3>
          <button
            onClick={() => {
              playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
            علشان "صاحب يومك" بيحافظ على خصوصيتك ومفهوش حسابات بكلمات مرور، تقدر تعمل نسخة احتياطية من كل بياناتك (مواعيدك، مهامك، وتفضيلاتك) وتحفظها عندك محلياً كملف بأي وقت، حتى وأنت أوفلاين!
          </p>

          {/* Status Message */}
          {status && (
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                status.type === 'success'
                  ? 'bg-[#EBF5EE] border-[#B2D8C0] text-[#1B4D3E]'
                  : 'bg-[#FAF3EA] border-[#E8D4B9] text-[#7C5528]'
              }`}
            >
              {status.type === 'success' ? (
                <Check className="w-4 h-4 text-[#439A62] shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#C58B5C] shrink-0 mt-0.5" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-3.5 rounded-2xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] disabled:opacity-50 transition-colors flex flex-col items-center justify-center gap-2 border border-transparent active:scale-95 cursor-pointer"
            >
              <Download className="w-5 h-5 text-[#D8C3A5]" />
              <span>{exporting ? 'جاري الحفظ...' : 'حفظ نسخة احتياطية'}</span>
            </button>

            {/* Import Button */}
            <button
              onClick={triggerFileSelect}
              disabled={importing}
              className="px-4 py-3.5 rounded-2xl bg-[#white] border border-[#E4DED4] text-[#243B35] text-xs font-bold hover:bg-[#F6F3EE] disabled:opacity-50 transition-colors flex flex-col items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-[#C58B5C]" />
              <span>{importing ? 'جاري الاسترجاع...' : 'استرجاع من ملف'}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Automatic Snapshots Section */}
          <div className="border-t border-[#E4DED4] pt-4 mt-2">
            <div className="flex items-center gap-2 mb-2 px-1 text-xs font-bold text-[#243B35]">
              <History className="w-4 h-4 text-[#C58B5C]" />
              <span>نسخ تلقائية (آخر 7 أيام) 🕒</span>
            </div>
            {snapshots.length === 0 ? (
              <p className="text-right text-[11px] text-[#77766F] px-1 italic">لا توجد نسخ تلقائية محفوظة حالياً.</p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {snapshots.map((snap) => {
                  const dateStr = new Date(snap.timestamp).toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div
                      key={snap.key}
                      className="bg-white/80 border border-[#E4DED4] rounded-xl p-2 flex justify-between items-center text-[11px]"
                    >
                      <div className="text-right flex-1">
                        <div className="font-semibold text-[#243B35]">{dateStr}</div>
                        <div className="text-[#77766F]">{snap.count} عناصر محفوظة</div>
                      </div>
                      <button
                        onClick={() => handleRestoreFromSnapshot(snap.key)}
                        disabled={importing || exporting}
                        className="px-2.5 py-1.5 bg-[#E4DED4] hover:bg-[#C58B5C] hover:text-white rounded-lg text-[10px] font-bold text-[#243B35] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        استرجاع
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
