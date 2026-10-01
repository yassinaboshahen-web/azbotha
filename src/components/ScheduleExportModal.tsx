import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Share2,
  Download,
  Loader2,
  Calendar,
  GraduationCap,
  BookOpen,
  Clock,
  BarChart3,
  Smartphone,
  LayoutGrid,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { sound } from '../utils/audio';
import {
  ReportMetrics,
  calculateReportMetrics,
} from '../utils/reportUtils';
import {
  buildWeekLayout,
  buildMonthLayout,
  buildTimetableLayout,
  buildStoryLayout,
  buildCoursesLayout,
  buildUpcomingLayout,
  buildSummaryLayout,
  TextMeasureFn,
  StoryScheduleLayout,
} from '../utils/scheduleLayout';
import {
  renderWeekToCanvas,
  renderMonthToCanvas,
  renderTimetableToCanvas,
  renderStoryToCanvas,
  renderCoursesToCanvas,
  renderUpcomingToCanvas,
  renderSummaryToCanvas,
} from '../utils/scheduleCanvasRenderer';
import {
  canvasToBlobAndDataUrl,
  saveOrDownloadImage,
  saveOrDownloadMultipleImages,
  shareExportedSchedule,
  getWeeklyExportFilename,
  getMonthlyExportFilename,
  getTimetableExportFilename,
  getStoryExportFilename,
  getCoursesExportFilename,
  getUpcomingExportFilename,
  getSummaryExportFilename,
} from '../utils/scheduleImageExporter';
import { indexedDBRepository } from '../repositories/indexedDBRepository';
import { CalendarEvent, TaskItem } from '../types';
import {
  parseDateString,
  formatDateToISO,
  getTodayDateString,
  getTaskDate,
  getWeekRange,
} from '../utils/dateUtils';

export type ExportTemplateType =
  | 'timetable'
  | 'courses'
  | 'upcoming'
  | 'summary'
  | 'week'
  | 'month'
  | 'story';

export interface ScheduleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'day' | 'week' | 'month';
  currentDateStr?: string;
  startDateStr?: string;
  endDateStr?: string;
  rangeFormatted?: string;
  periodName?: string;
  metrics?: ReportMetrics;
  onShowToast?: (message: string, type: 'info' | 'success' | 'error' | 'undo') => void;
}

interface TemplateOption {
  id: ExportTemplateType;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

const TEMPLATES_BY_MODE: Record<'day' | 'week' | 'month', TemplateOption[]> = {
  day: [
    { id: 'story', title: 'جدول اليوم (ستوري)', subtitle: 'مقاس ستوري 1080×1920', icon: Smartphone },
    { id: 'upcoming', title: 'اللي قدامك', subtitle: 'الـ 14 يوم الجايين', icon: Clock },
    { id: 'summary', title: 'ملخص الإنجاز', subtitle: 'إحصائيات ونشاط', icon: BarChart3 },
  ],
  week: [
    { id: 'timetable', title: 'جدول المحاضرات', subtitle: 'محور ساعات ومسارات', icon: GraduationCap },
    { id: 'courses', title: 'جدول المواد', subtitle: 'مقسمة بالدكتور والسكشن', icon: BookOpen },
    { id: 'week', title: 'الجدول الأسبوعي', subtitle: 'كروت الأيام والمهام', icon: LayoutGrid },
    { id: 'upcoming', title: 'اللي قدامك', subtitle: 'الـ 14 يوم الجايين', icon: Clock },
    { id: 'summary', title: 'ملخص الإنجاز', subtitle: 'تقرير الإنجاز', icon: BarChart3 },
  ],
  month: [
    { id: 'month', title: 'الجدول الشهري', subtitle: 'شبكة الشهر بالكامل', icon: Calendar },
    { id: 'summary', title: 'ملخص الإنجاز', subtitle: 'تقرير إنتاجية الشهر', icon: BarChart3 },
    { id: 'upcoming', title: 'اللي قدامك', subtitle: 'الـ 14 يوم الجايين', icon: Clock },
  ],
};

const ARABIC_DAYS_ORDER = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const ScheduleExportModal: React.FC<ScheduleExportModalProps> = ({
  isOpen,
  onClose,
  mode = 'week',
  currentDateStr,
  startDateStr = '',
  endDateStr = '',
  rangeFormatted,
  periodName,
  onShowToast,
}) => {
  const availableTemplates = TEMPLATES_BY_MODE[mode] || TEMPLATES_BY_MODE.week;
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplateType>(
    availableTemplates[0]?.id || 'week'
  );

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isRenderingCanvas, setIsRenderingCanvas] = useState(false);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);
  const [lastFileUri, setLastFileUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Story Pagination state
  const [storyTotalPages, setStoryTotalPages] = useState(1);
  const [storyCurrentPage, setStoryCurrentPage] = useState(0);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderedCanvasesRef = useRef<HTMLCanvasElement[]>([]);

  // Load preferences to restore last selected template
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const initDataAndPrefs = async () => {
      setIsLoadingData(true);
      try {
        const [evts, tsks, prefs] = await Promise.all([
          indexedDBRepository.getAllEvents(),
          indexedDBRepository.getAllTasks(),
          indexedDBRepository.getPreferences(),
        ]);

        if (!isMounted) return;
        setAllEvents(evts);
        setAllTasks(tsks);

        const savedKey = `last_export_template_${mode}`;
        const savedTpl = (prefs as any)?.[savedKey] as ExportTemplateType | undefined;
        if (savedTpl && availableTemplates.some((t) => t.id === savedTpl)) {
          setSelectedTemplate(savedTpl);
        } else {
          setSelectedTemplate(availableTemplates[0].id);
        }
      } catch (err) {
        console.error('Failed to load export data from IndexedDB:', err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    initDataAndPrefs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode]);

  // Save template choice to preferences
  const handleSelectTemplate = async (templateId: ExportTemplateType) => {
    sound.playTap();
    setSelectedTemplate(templateId);
    setStoryCurrentPage(0);

    try {
      const prefs = await indexedDBRepository.getPreferences();
      const updated = {
        ...prefs,
        [`last_export_template_${mode}`]: templateId,
      };
      await indexedDBRepository.savePreferences(updated);
    } catch {
      // ignore
    }
  };

  // Compute active date strings
  const todayStr = useMemo(() => getTodayDateString(), []);
  const activeTargetDate = currentDateStr || startDateStr || todayStr;

  // Offscreen measurement helper
  const measureText: TextMeasureFn = useMemo(() => {
    let offscreenCtx: CanvasRenderingContext2D | null = null;
    return (text: string, font: string) => {
      if (typeof document === 'undefined') return text.length * 10;
      if (!offscreenCtx) {
        const canvas = document.createElement('canvas');
        offscreenCtx = canvas.getContext('2d');
      }
      if (!offscreenCtx) return text.length * 10;
      offscreenCtx.font = font;
      return offscreenCtx.measureText(text).width;
    };
  }, []);

  // Determine week range
  const weekRange = useMemo(() => {
    if (startDateStr && endDateStr) {
      return { startDate: startDateStr, endDate: endDateStr };
    }
    return getWeekRange(activeTargetDate);
  }, [startDateStr, endDateStr, activeTargetDate]);

  // Render canvas pipeline
  useEffect(() => {
    if (!isOpen || isLoadingData) return;

    let isCancelled = false;
    setErrorMessage(null);
    setIsRenderingCanvas(true);

    const renderJob = async () => {
      try {
        let generatedCanvases: HTMLCanvasElement[] = [];

        if (selectedTemplate === 'timetable') {
          const layout = buildTimetableLayout(
            {
              startDateStr: weekRange.startDate,
              endDateStr: weekRange.endDate,
              rangeFormatted: rangeFormatted || `${weekRange.startDate} – ${weekRange.endDate}`,
              todayStr,
              events: allEvents,
            },
            measureText
          );

          if (layout.isEmpty) {
            setErrorMessage('مفيش محاضرات أو مواعيد مسجلة في هذا الأسبوع.');
          }

          const canvas = await renderTimetableToCanvas(layout);
          generatedCanvases = [canvas];
        } else if (selectedTemplate === 'courses') {
          const layout = buildCoursesLayout(
            {
              startDateStr: weekRange.startDate,
              endDateStr: weekRange.endDate,
              rangeFormatted: rangeFormatted || `${weekRange.startDate} – ${weekRange.endDate}`,
              todayStr,
              events: allEvents,
            },
            measureText
          );

          if (layout.hasNoCourses && layout.courses.length === 0) {
            setErrorMessage('مفيش مواد محددة في المواعيد. ضيف اسم "المادة" من تفاصيل الموعد.');
          }

          const canvas = await renderCoursesToCanvas(layout);
          generatedCanvases = [canvas];
        } else if (selectedTemplate === 'story') {
          const layout: StoryScheduleLayout = buildStoryLayout(
            {
              dateStr: activeTargetDate,
              todayStr,
              events: allEvents,
              tasks: allTasks,
            },
            measureText
          );

          if (layout.isEmpty) {
            setErrorMessage('مفيش مواعيد أو مهام مسجلة في هذا اليوم.');
          }

          setStoryTotalPages(layout.pages.length);

          const canvases: HTMLCanvasElement[] = [];
          for (let p = 0; p < layout.pages.length; p++) {
            const pCanvas = await renderStoryToCanvas(layout, p);
            canvases.push(pCanvas);
          }
          generatedCanvases = canvases;
        } else if (selectedTemplate === 'upcoming') {
          const layout = buildUpcomingLayout(
            {
              todayStr,
              events: allEvents,
              tasks: allTasks,
            },
            measureText
          );

          if (layout.isEmpty) {
            setErrorMessage('قدامك أسبوعين رايقين ومفيش أي مواعيد أو مهام.');
          }

          const canvas = await renderUpcomingToCanvas(layout);
          generatedCanvases = [canvas];
        } else if (selectedTemplate === 'summary') {
          const startD = mode === 'month' ? `${activeTargetDate.slice(0, 7)}-01` : weekRange.startDate;
          const endD = mode === 'month' ? `${activeTargetDate.slice(0, 7)}-31` : weekRange.endDate;

          const metrics = calculateReportMetrics(
            allEvents,
            allTasks,
            startD,
            endD,
            todayStr
          );

          // Compute daily counts for chart
          const dailyCounts: Array<{ dateStr: string; dayName: string; count: number }> = [];
          const s = parseDateString(startD);
          const numDays = mode === 'month' ? 30 : 7;

          for (let i = 0; i < numDays; i++) {
            const d = new Date(s);
            d.setDate(s.getDate() + i);
            const dStr = formatDateToISO(d);
            const dayEvents = allEvents.filter((e) => !(e as any).deleted && e.date === dStr);
            const dName = ARABIC_DAYS_ORDER[(d.getDay() + 1) % 7];
            dailyCounts.push({
              dateStr: dStr,
              dayName: mode === 'month' ? `${d.getDate()}` : dName.slice(0, 3),
              count: dayEvents.length,
            });
          }

          const layout = buildSummaryLayout(
            {
              startDateStr: startD,
              endDateStr: endD,
              rangeFormatted: rangeFormatted || `${startD} – ${endD}`,
              todayStr,
              metrics,
              dailyCounts: mode === 'week' ? dailyCounts.slice(0, 7) : dailyCounts,
            },
            measureText
          );

          if (layout.isEmpty) {
            setErrorMessage('مفيش بيانات كافية لعرض ملخص الإنجاز في هذه الفترة.');
          }

          const canvas = await renderSummaryToCanvas(layout);
          generatedCanvases = [canvas];
        } else if (selectedTemplate === 'month') {
          const activeDate = parseDateString(activeTargetDate);
          const y = activeDate.getFullYear();
          const m = activeDate.getMonth();
          const firstDay = new Date(y, m, 1);
          const lastDay = new Date(y, m + 1, 0);

          const startMonthStr = formatDateToISO(firstDay);
          const endMonthStr = formatDateToISO(lastDay);

          const monthEvents = allEvents.filter(
            (e) => !(e as any).deleted && e.date >= startMonthStr && e.date <= endMonthStr
          );
          const monthTasks = allTasks.filter((t) => {
            const td = getTaskDate(t);
            return !(t as any).deleted && td >= startMonthStr && td <= endMonthStr;
          });

          const completedEvts = monthEvents.filter((e) => e.completed).length;
          const completedTsks = monthTasks.filter((t) => t.completed).length;
          const totalItems = monthEvents.length + monthTasks.length;
          const completionRate =
            totalItems > 0 ? Math.round(((completedEvts + completedTsks) / totalItems) * 100) : 100;

          // Padding before
          const diffToSat = (firstDay.getDay() + 1) % 7;
          const gridDays: any[] = [];

          for (let i = diffToSat; i > 0; i--) {
            const pd = new Date(firstDay);
            pd.setDate(firstDay.getDate() - i);
            gridDays.push({
              date: formatDateToISO(pd),
              dayNumber: pd.getDate(),
              isCurrentMonth: false,
              isToday: false,
              events: [],
              tasks: [],
            });
          }

          for (let d = 1; d <= lastDay.getDate(); d++) {
            const cd = new Date(y, m, d);
            const cdStr = formatDateToISO(cd);
            gridDays.push({
              date: cdStr,
              dayNumber: d,
              isCurrentMonth: true,
              isToday: cdStr === todayStr,
              events: monthEvents.filter((e) => e.date === cdStr),
              tasks: monthTasks.filter((t) => getTaskDate(t) === cdStr),
            });
          }

          const layout = buildMonthLayout(
            {
              monthName: ARABIC_MONTH_NAMES[m],
              year: y,
              monthDateStr: activeTargetDate.slice(0, 7),
              todayStr,
              gridDays,
              metrics: {
                totalEvents: monthEvents.length,
                completedEvents: completedEvts,
                totalTasks: monthTasks.length,
                completedTasks: completedTsks,
                completionRate,
              },
            },
            measureText
          );

          const canvas = await renderMonthToCanvas(layout);
          generatedCanvases = [canvas];
        } else {
          // Default Week
          const activeDate = parseDateString(weekRange.startDate);
          const weekDaysList: any[] = [];

          for (let i = 0; i < 7; i++) {
            const cd = new Date(activeDate);
            cd.setDate(activeDate.getDate() + i);
            const cdStr = formatDateToISO(cd);
            const dayIdx = cd.getDay();
            const dayName = ARABIC_DAYS_ORDER[(dayIdx + 1) % 7];

            weekDaysList.push({
              date: cdStr,
              dayName,
              dayNumber: cd.getDate(),
              monthName: ARABIC_MONTH_NAMES[cd.getMonth()],
              events: allEvents.filter((e) => !(e as any).deleted && e.date === cdStr),
              tasks: allTasks.filter((t) => !(t as any).deleted && getTaskDate(t) === cdStr),
            });
          }

          const weekEvts = allEvents.filter(
            (e) => !(e as any).deleted && e.date >= weekRange.startDate && e.date <= weekRange.endDate
          );
          const weekTsks = allTasks.filter((t) => {
            const td = getTaskDate(t);
            return !(t as any).deleted && td >= weekRange.startDate && td <= weekRange.endDate;
          });

          const completedEvts = weekEvts.filter((e) => e.completed).length;
          const completedTsks = weekTsks.filter((t) => t.completed).length;
          const totalItems = weekEvts.length + weekTsks.length;
          const completionRate =
            totalItems > 0 ? Math.round(((completedEvts + completedTsks) / totalItems) * 100) : 100;

          const layout = buildWeekLayout(
            {
              startDateStr: weekRange.startDate,
              endDateStr: weekRange.endDate,
              rangeFormatted: rangeFormatted || `${weekRange.startDate} – ${weekRange.endDate}`,
              todayStr,
              days: weekDaysList,
              metrics: {
                totalEvents: weekEvts.length,
                completedEvents: completedEvts,
                totalTasks: weekTsks.length,
                completedTasks: completedTsks,
                completionRate,
              },
            },
            measureText
          );

          const canvas = await renderWeekToCanvas(layout);
          generatedCanvases = [canvas];
        }

        if (isCancelled) return;

        currentRenderedCanvasesRef.current = generatedCanvases;

        const activeCanvas =
          selectedTemplate === 'story'
            ? generatedCanvases[storyCurrentPage] || generatedCanvases[0]
            : generatedCanvases[0];

        if (activeCanvas) {
          const { dataUrl } = await canvasToBlobAndDataUrl(activeCanvas);
          if (!isCancelled) {
            setLastGeneratedUrl(dataUrl);
            setLastFileUri(null);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Canvas render error:', err);
          setErrorMessage(err?.message || 'حدث خطأ أثناء رسم جدول التصدير');
        }
      } finally {
        if (!isCancelled) setIsRenderingCanvas(false);
      }
    };

    const animFrameId = requestAnimationFrame(() => {
      renderJob();
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animFrameId);
    };
  }, [
    isOpen,
    isLoadingData,
    selectedTemplate,
    storyCurrentPage,
    allEvents,
    allTasks,
    activeTargetDate,
    weekRange,
    todayStr,
    rangeFormatted,
    mode,
    measureText,
  ]);

  if (!isOpen) return null;

  // Filename generator helper based on current template
  const getExportFilename = (pageIdx: number = 1): string => {
    switch (selectedTemplate) {
      case 'timetable':
        return getTimetableExportFilename(weekRange.startDate);
      case 'courses':
        return getCoursesExportFilename(weekRange.startDate);
      case 'story':
        return getStoryExportFilename(activeTargetDate, pageIdx);
      case 'upcoming':
        return getUpcomingExportFilename(todayStr);
      case 'summary':
        return getSummaryExportFilename(activeTargetDate);
      case 'month':
        return getMonthlyExportFilename(activeTargetDate);
      case 'week':
      default:
        return getWeeklyExportFilename(weekRange.startDate, weekRange.endDate);
    }
  };

  // Export / Save Action
  const handleSaveImage = async () => {
    sound.playTap();
    if (isExporting || isRenderingCanvas) return;

    const canvases = currentRenderedCanvasesRef.current;
    if (!canvases || canvases.length === 0) {
      onShowToast?.('الصورة غير جاهزة بعد، حاول مجدداً', 'error');
      return;
    }

    setIsExporting(true);
    try {
      if (selectedTemplate === 'story' && canvases.length > 1) {
        // Multi-page export
        const items = await Promise.all(
          canvases.map(async (c, idx) => {
            const { dataUrl } = await canvasToBlobAndDataUrl(c);
            return { dataUrl, filename: getExportFilename(idx + 1) };
          })
        );
        const results = await saveOrDownloadMultipleImages(items);
        const allSuccess = results.every((r) => r.success);
        if (allSuccess) {
          sound.playCheck();
          onShowToast?.(`تم حفظ ${canvases.length} صفحات بنجاح 🎉`, 'success');
        } else {
          onShowToast?.('تم حفظ بعض الصور وتعذر الباقي', 'info');
        }
      } else {
        const targetCanvas = canvases[storyCurrentPage] || canvases[0];
        const { dataUrl } = await canvasToBlobAndDataUrl(targetCanvas);
        const filename = getExportFilename(storyCurrentPage + 1);
        const result = await saveOrDownloadImage(dataUrl, filename);

        if (result.success) {
          if (result.fileUri) setLastFileUri(result.fileUri);
          sound.playCheck();
          onShowToast?.('تم حفظ الصورة بجودة عالية بنجاح! 📸', 'success');
        } else {
          onShowToast?.(result.error || 'فشل حفظ الصورة', 'error');
        }
      }
    } catch (err: any) {
      onShowToast?.(err?.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Share Action
  const handleShareImage = async () => {
    sound.playTap();
    if (isExporting || isRenderingCanvas) return;

    const canvases = currentRenderedCanvasesRef.current;
    if (!canvases || canvases.length === 0) {
      onShowToast?.('الصورة غير جاهزة بعد', 'error');
      return;
    }

    setIsExporting(true);
    try {
      const targetCanvas = canvases[storyCurrentPage] || canvases[0];
      const { dataUrl } = await canvasToBlobAndDataUrl(targetCanvas);
      const filename = getExportFilename(storyCurrentPage + 1);
      const fileToShare = lastFileUri || dataUrl;

      const shared = await shareExportedSchedule(
        fileToShare,
        filename,
        availableTemplates.find((t) => t.id === selectedTemplate)?.title || 'جدول المواعيد'
      );

      if (shared) {
        sound.playCheck();
        onShowToast?.('تمت المشاركة بنجاح! ✨', 'success');
      }
    } catch (err: any) {
      onShowToast?.(err?.message || 'تعذرت المشاركة', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تصدير جدول المواعيد"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[#F6F3EE] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-[#E4DED4] shadow-2xl overflow-hidden text-[#242522]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E4DED4] bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#243B35]/10 flex items-center justify-center text-[#243B35]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
                تصدير ومشاركة الجدول
              </h2>
              <p className="text-xs text-[#77766F]">
                صور عالية الجودة للمشاركة والطباعة
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Template Selection Tabs (Horizontal Scroll) */}
          <div>
            <label className="text-xs font-bold text-[#77766F] block mb-2 px-1">
              اختر قالب الصورة:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
              {availableTemplates.map((t) => {
                const IconComponent = t.icon;
                const isSelected = selectedTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t.id)}
                    className={`shrink-0 snap-start flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer text-right min-w-[150px] sm:min-w-[170px] ${
                      isSelected
                        ? 'bg-[#243B35] text-white border-[#243B35] shadow-xs'
                        : 'bg-white text-[#242522] border-[#E4DED4] hover:border-[#243B35]/40'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#F6F3EE] text-[#243B35]'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate">{t.title}</p>
                      <p
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-white/80' : 'text-[#77766F]'
                        }`}
                      >
                        {t.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Story Page Selector (If Story template with multi-page) */}
          {selectedTemplate === 'story' && storyTotalPages > 1 && (
            <div className="bg-white border border-[#E4DED4] rounded-2xl p-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-[#243B35] px-2">
                صفحة {storyCurrentPage + 1} من {storyTotalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    sound.playTap();
                    setStoryCurrentPage((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={storyCurrentPage === 0}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F3EE] hover:bg-[#E4DED4] disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>السابقة</span>
                </button>
                <button
                  onClick={() => {
                    sound.playTap();
                    setStoryCurrentPage((prev) => Math.min(storyTotalPages - 1, prev + 1));
                  }}
                  disabled={storyCurrentPage === storyTotalPages - 1}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F6F3EE] hover:bg-[#E4DED4] disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>التالية</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Warning / Empty Error Message if applicable */}
          {errorMessage && (
            <div className="bg-[#FDF2F0] border border-[#EFC7C2] rounded-2xl p-3.5 text-xs text-[#B86B61] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="font-semibold">{errorMessage}</p>
            </div>
          )}

          {/* Live Preview Canvas Container */}
          <div className="relative rounded-2xl overflow-hidden border border-[#E4DED4] bg-neutral-100 shadow-inner flex items-center justify-center min-h-[260px] max-h-[460px] p-2">
            {isRenderingCanvas || isLoadingData ? (
              <div className="flex flex-col items-center justify-center gap-2 text-[#77766F] py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#C58B5C]" />
                <p className="text-xs font-bold">جاري تجهيز الصورة بجودة عالية...</p>
              </div>
            ) : lastGeneratedUrl ? (
              <img
                src={lastGeneratedUrl}
                alt="معاينة الجدول المصدّر"
                className="w-auto h-auto max-h-[440px] max-w-full rounded-xl object-contain shadow-xs"
              />
            ) : (
              <div className="text-center py-12 text-[#77766F]">
                <p className="text-xs font-semibold">تعذر عرض المعاينة</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-4 border-t border-[#E4DED4] bg-white flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#77766F] hidden sm:block">
            {selectedTemplate === 'story' && storyTotalPages > 1
              ? `سيتم حفظ ${storyTotalPages} صور ستوري`
              : 'PNG عالي الدقة بخط تجوال'}
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleSaveImage}
              disabled={isExporting || isRenderingCanvas || Boolean(errorMessage)}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {selectedTemplate === 'story' && storyTotalPages > 1
                  ? 'حفظ كل الصفحات'
                  : 'حفظ كصورة'}
              </span>
            </button>

            <button
              onClick={handleShareImage}
              disabled={isExporting || isRenderingCanvas || Boolean(errorMessage)}
              className="py-2.5 px-4 rounded-xl bg-[#F6F3EE] text-[#243B35] border border-[#E4DED4] hover:bg-[#E4DED4] font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#C58B5C]" />
              <span>مشاركة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WeeklyExportModal = ScheduleExportModal;
