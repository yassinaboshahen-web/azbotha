import React, { useState, useEffect } from 'react';
import { CalendarEvent, TaskItem, QuickThought, EventCategory } from '../types';
import { Clock, CheckSquare, Bookmark, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { sound } from '../utils/audio';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onAddEvent: (event: Omit<CalendarEvent, 'id' | 'completed'>) => Promise<boolean>;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed'>) => Promise<boolean>;
  onAddThought: (thought: Omit<QuickThought, 'id'>) => void;
}

type AddTab = 'event' | 'task' | 'thought';

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onAddEvent,
  onAddTask,
  onAddThought,
}) => {
  const [activeTab, setActiveTab] = useState<AddTab>('event');
  const [showAdvancedEvent, setShowAdvancedEvent] = useState(false);
  const [showAdvancedTask, setShowAdvancedTask] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Event State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(selectedDate);
  const [eventTime, setEventTime] = useState('12:00');
  const [eventEndTime, setEventEndTime] = useState('13:30');
  const [eventCategory, setEventCategory] = useState<EventCategory>('lecture');
  const [eventLocation, setEventLocation] = useState('');
  const [eventInstructor, setEventInstructor] = useState('');
  const [eventCourse, setEventCourse] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventReminder, setEventReminder] = useState(true);

  // Task State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'urgent' | 'normal' | 'light'>('normal');
  const [taskCategory, setTaskCategory] = useState('جامعة');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskReminder, setTaskReminder] = useState(true);
  const [taskDueTime, setTaskDueTime] = useState('');

  // Thought State
  const [thoughtText, setThoughtText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!eventTitle.trim()) {
      setErrorMessage('اكتب اسم الحاجة الأول.');
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryLabels: Record<EventCategory, string> = {
        lecture: 'محاضرة',
        section: 'سكشن',
        meeting: 'ميتينج',
        workout: 'تمرين',
        personal: 'شخصي',
        study: 'مذاكرة',
        custom: 'معاد',
      };

      const success = await onAddEvent({
        title: eventTitle.trim(),
        date: eventDate || selectedDate,
        time: eventTime || '12:00',
        endTime: eventEndTime || undefined,
        category: eventCategory,
        categoryLabel: categoryLabels[eventCategory] || 'معاد',
        location: eventLocation.trim() || undefined,
        instructor: eventInstructor.trim() || undefined,
        course: eventCourse.trim() || undefined,
        notes: eventNotes.trim() || undefined,
        reminder: eventReminder,
        priority: 'normal',
      });

      if (success) {
        sound.playPop();
        onClose();
        resetForms();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!taskTitle.trim()) {
      setErrorMessage('اكتب عنوان المهمة الأول.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAddTask({
        title: taskTitle.trim(),
        date: selectedDate,
        priority: taskPriority,
        category: taskCategory.trim() || undefined,
        notes: taskNotes.trim() || undefined,
        reminder: taskReminder,
        due_time: taskDueTime || undefined,
      });

      if (success) {
        sound.playPop();
        onClose();
        resetForms();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!thoughtText.trim()) {
      setErrorMessage('اكتب الفكرة اللي في بالك الأول.');
      return;
    }

    setIsSubmitting(true);
    try {
      onAddThought({
        text: thoughtText.trim(),
        date: selectedDate,
        pinned: true,
      });

      sound.playPop();
      onClose();
      resetForms();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForms = () => {
    setEventTitle('');
    setEventLocation('');
    setEventInstructor('');
    setEventCourse('');
    setEventNotes('');
    setTaskTitle('');
    setTaskNotes('');
    setThoughtText('');
    setErrorMessage('');
    setShowAdvancedEvent(false);
    setShowAdvancedTask(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog Modal */}
      <div className="relative z-10 w-full sm:max-w-lg bg-[#F6F3EE] rounded-t-3xl sm:rounded-3xl border border-[#E4DED4] shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4DED4]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#243B35]">
              إيه اللي وراك؟ 👀
            </h2>
            <p className="text-xs text-[#77766F] mt-0.5">
              سجل اللي في بالك وهنرتبه في يومك على طول.
            </p>
          </div>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-2 bg-[#E4DED4]/60 p-1 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('event');
              setErrorMessage('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'event'
                ? 'bg-[#243B35] text-[#F6F3EE] shadow-xs'
                : 'text-[#77766F] hover:text-[#243B35]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>⏰ معاد</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('task');
              setErrorMessage('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'task'
                ? 'bg-[#243B35] text-[#F6F3EE] shadow-xs'
                : 'text-[#77766F] hover:text-[#243B35]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>📝 مهمة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              setActiveTab('thought');
              setErrorMessage('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'thought'
                ? 'bg-[#243B35] text-[#F6F3EE] shadow-xs'
                : 'text-[#77766F] hover:text-[#243B35]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>📌 حاجة تانية</span>
          </button>
        </div>

        {/* Friendly validation banner */}
        {errorMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#B86B61]/15 text-[#B86B61] text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* FORM 1: EVENT */}
        {activeTab === 'event' && (
          <form onSubmit={handleSaveEvent} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                عنوان المعاد أو المحاضرة *
              </label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => {
                  setEventTitle(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="مثال: محاضرة ميكانيكا، ميتينج الشغل، جيم..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  من الساعة
                </label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  لحد الساعة
                </label>
                <input
                  type="time"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  النوع
                </label>
                <select
                  value={eventCategory}
                  onChange={(e) => setEventCategory(e.target.value as EventCategory)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                >
                  <option value="lecture">محاضرة</option>
                  <option value="section">سكشن</option>
                  <option value="meeting">ميتينج</option>
                  <option value="workout">تمرين وجيم</option>
                  <option value="personal">شخصي وخروجات</option>
                  <option value="study">مذاكرة وبحث</option>
                  <option value="custom">معاد عام</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  المكان (اختياري)
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="مدرج 3، زووم، كافيه..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                />
              </div>
            </div>

            {/* Progressive Disclosure Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedEvent(!showAdvancedEvent)}
              className="text-xs font-semibold text-[#C58B5C] hover:text-[#9e673c] flex items-center gap-1 transition-colors pt-1 cursor-pointer"
            >
              <span>{showAdvancedEvent ? 'إخفاء التفاصيل الإضافية' : '+ تفاصيل أكتر (المادة، المحاضر، ملاحظات)'}</span>
              {showAdvancedEvent ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedEvent && (
              <div className="space-y-3 p-3.5 bg-white/60 rounded-2xl border border-[#E4DED4]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#243B35] mb-1">
                      المادة أو الكورس
                    </label>
                    <input
                      type="text"
                      value={eventCourse}
                      onChange={(e) => setEventCourse(e.target.value)}
                      placeholder="فيزياء، تسويق..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#243B35] mb-1">
                      الدكتور أو المعيد
                    </label>
                    <input
                      type="text"
                      value={eventInstructor}
                      onChange={(e) => setEventInstructor(e.target.value)}
                      placeholder="د. مصطفى..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#243B35] mb-1">
                    ملاحظات تفكرك
                  </label>
                  <textarea
                    rows={2}
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    placeholder="تسليم شيت، طباعة ورق..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522] resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-[#243B35] text-[#F6F3EE] font-bold text-sm hover:bg-[#1b2d28] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ضيف المعاد ده لليوم</span>
            </button>
          </form>
        )}

        {/* FORM 2: TASK */}
        {activeTab === 'task' && (
          <form onSubmit={handleSaveTask} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                عنوان المهمة *
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="مثال: تسليم شيت الماث، حجز تذكرة القطر..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  الأولوية
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                >
                  <option value="normal">عادية</option>
                  <option value="urgent">عاجلة جداً ⚡️</option>
                  <option value="light">خفيفة ومريحة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  التصنيف
                </label>
                <input
                  type="text"
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  placeholder="جامعة، شغل..."
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 self-center">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#243B35]">
                      <input type="checkbox" checked={taskReminder} onChange={e => setTaskReminder(e.target.checked)} className="rounded border-[#E4DED4] text-[#243B35] focus:ring-[#243B35]" />
                      تذكير
                  </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  وقت التذكير
                </label>
                <input
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
                />
              </div>
            </div>

            {/* Progressive Disclosure for Task */}
            <button
              type="button"
              onClick={() => setShowAdvancedTask(!showAdvancedTask)}
              className="text-xs font-semibold text-[#C58B5C] hover:text-[#9e673c] flex items-center gap-1 transition-colors pt-1 cursor-pointer"
            >
              <span>{showAdvancedTask ? 'إخفاء الملاحظات' : '+ ملاحظات إضافية للمهمة'}</span>
              {showAdvancedTask ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvancedTask && (
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                  ملاحظات
                </label>
                <textarea
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="أي تفاصيل تفكرك بيها..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs sm:text-sm text-[#242522] focus:outline-none focus:border-[#243B35] resize-none"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-[#243B35] text-[#F6F3EE] font-bold text-sm hover:bg-[#1b2d28] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>سجل المهمة</span>
            </button>
          </form>
        )}

        {/* FORM 3: THOUGHT / NOTE */}
        {activeTab === 'thought' && (
          <form onSubmit={handleSaveThought} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1.5">
                خاطرة سريعة أو فكرة في بالك *
              </label>
              <textarea
                rows={4}
                value={thoughtText}
                onChange={(e) => {
                  setThoughtText(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="اكتب أي حاجة حابب تفتكرها، زي فكرة مشروع أو حاجة تشتريها وأنت راجع..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E4DED4] text-sm text-[#242522] focus:outline-none focus:border-[#243B35] resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-[#243B35] text-[#F6F3EE] font-bold text-sm hover:bg-[#1b2d28] transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حفظ الملاحظة</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
