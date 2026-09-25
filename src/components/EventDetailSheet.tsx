import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventCategory } from '../types';
import { formatTime12h, formatArabicFullDate, getEventStatus, getRelativeDateString } from '../utils/dateUtils';
import {
  X,
  Check,
  MapPin,
  User,
  FileText,
  Bell,
  Trash2,
  Edit3,
  BookOpen,
  Save,
  Clock,
  CalendarPlus,
  AlertCircle,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface EventDetailSheetProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onToggleComplete: (eventId: string) => void;
  onToggleReminder: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onUpdateEvent?: (updatedEvent: CalendarEvent) => void;
  onMoveToDate?: (eventId: string, newDateStr: string) => void;
}

export const EventDetailSheet: React.FC<EventDetailSheetProps> = ({
  event,
  onClose,
  onToggleComplete,
  onToggleReminder,
  onDeleteEvent,
  onUpdateEvent,
  onMoveToDate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState<EventCategory>('lecture');
  const [location, setLocation] = useState('');
  const [instructor, setInstructor] = useState('');
  const [course, setCourse] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState(true);
  const [validationError, setValidationError] = useState('');

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setEventDate(event.date || '');
      setTime(event.time || '09:00');
      setEndTime(event.endTime || '');
      setCategory(event.category || 'lecture');
      setLocation(event.location || '');
      setInstructor(event.instructor || '');
      setCourse(event.course || '');
      setNotes(event.notes || '');
      setReminder(event.reminder ?? true);
      setIsEditing(false);
      setValidationError('');
    }
  }, [event]);

  if (!event) return null;

  const { formattedDate } = formatArabicFullDate(event.date);
  const eventStatus = getEventStatus(event.date, event.time, event.endTime, event.completed);
  const isPast = eventStatus === 'past' && !event.completed;
  const isCurrent = eventStatus === 'current';
  const isUpcoming = eventStatus === 'next';

  const categoryLabels: Record<EventCategory, string> = {
    lecture: 'محاضرة',
    section: 'سكشن',
    meeting: 'ميتينج',
    workout: 'تمرين',
    personal: 'شخصي',
    study: 'مذاكرة',
    custom: 'معاد',
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('اكتب اسم الحاجة الأول.');
      return;
    }

    if (onUpdateEvent) {
      onUpdateEvent({
        ...event,
        title: title.trim(),
        date: eventDate || event.date,
        time,
        endTime: endTime.trim() || undefined,
        category,
        categoryLabel: categoryLabels[category] || 'معاد',
        location: location.trim() || undefined,
        instructor: instructor.trim() || undefined,
        course: course.trim() || undefined,
        notes: notes.trim() || undefined,
        reminder,
      });
    }

    sound.playPop();
    setIsEditing(false);
  };

  const handleMoveToTomorrow = () => {
    const tomorrowStr = getRelativeDateString(1);
    if (onMoveToDate) {
      onMoveToDate(event.id, tomorrowStr);
    } else if (onUpdateEvent) {
      onUpdateEvent({
        ...event,
        date: tomorrowStr,
      });
    }
    sound.playPop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative z-10 w-full sm:max-w-md bg-[#F6F3EE] rounded-t-3xl sm:rounded-3xl border border-[#E4DED4] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E4DED4] text-[#243B35]">
              {event.categoryLabel}
            </span>
            <span className="text-xs text-[#77766F]">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && onUpdateEvent && (
              <button
                onClick={() => {
                  sound.playTap();
                  setIsEditing(true);
                }}
                className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#243B35] hover:bg-[#E4DED4] flex items-center justify-center transition-colors cursor-pointer"
                title="تعديل المعاد"
                aria-label="تعديل المعاد"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                sound.playTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Callouts */}
        {isPast && (
          <div className="mb-4 p-3 bg-[#FAF3EA] border border-[#E8D4B9] rounded-2xl flex items-start gap-2.5 text-xs text-[#7C5528]">
            <AlertCircle className="w-4 h-4 text-[#C58B5C] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">الميعاد ده عدى.</span>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                لو لسه محتاج تعمله، نقدر نحطه في وقت تاني أو نرحله لبكرة.
              </p>
              <button
                onClick={handleMoveToTomorrow}
                className="mt-2 text-xs font-bold text-[#243B35] bg-white px-3 py-1 rounded-lg border border-[#E8D4B9] hover:bg-[#F6F3EE] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-[#C58B5C]" />
                <span>ترحيل لبكرة</span>
              </button>
            </div>
          </div>
        )}

        {isCurrent && (
          <div className="mb-4 p-2.5 bg-[#E8EFEA] border border-[#BACFC2] rounded-2xl flex items-center gap-2 text-xs text-[#243B35]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6F8F78] animate-pulse" />
            <span className="font-bold">ده المعاد الحالي شغال دلوقتي 🟢</span>
          </div>
        )}

        {isUpcoming && (
          <div className="mb-4 p-2.5 bg-[#FBF0E4] border border-[#E8CEB5] rounded-2xl flex items-center gap-2 text-xs text-[#8C582B]">
            <Clock className="w-4 h-4 text-[#C58B5C]" />
            <span className="font-bold">اللي جاي 👀 — جهز نفسك</span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {validationError && (
              <div className="p-2.5 rounded-xl bg-[#B86B61]/15 text-[#B86B61] text-xs font-semibold">
                {validationError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1">
                عنوان المعاد أو النشاط *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (validationError) setValidationError('');
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E4DED4] text-sm text-[#242522] focus:outline-none focus:border-[#243B35]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1">
                تاريخ المعاد
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1">من الساعة</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1">لحد الساعة</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1">النوع</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
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
                <label className="block text-xs font-semibold text-[#243B35] mb-1">المادة / الموضوع</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="مثال: فيزياء 1..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1">المكان</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مدرج 4، زووم..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#243B35] mb-1">الدكتور / الشخص</label>
                <input
                  type="text"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  placeholder="د. أحمد، م. سارة..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#243B35] mb-1">ملاحظات</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4DED4] text-xs text-[#242522] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#243B35] text-[#F6F3EE] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#1b2d28] transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl bg-[#E4DED4] text-[#243B35] font-semibold text-xs hover:bg-[#d8d0c2] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Title & Time */}
            <h2 className="text-xl font-bold text-[#243B35] mb-2">
              {event.title}
            </h2>

            <div className="text-sm font-bold text-[#C58B5C] mb-5">
              {formatTime12h(event.time)} {event.endTime && `إلى ${formatTime12h(event.endTime)}`}
            </div>

            {/* Detail Rows */}
            <div className="space-y-3.5 bg-white rounded-2xl p-4 border border-[#E4DED4] mb-5">
              {event.course && (
                <div className="flex items-start gap-3 text-xs sm:text-sm text-[#242522]">
                  <BookOpen className="w-4 h-4 text-[#A3A198] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#77766F] block text-xs">المادة أو الكورس:</span>
                    <span>{event.course}</span>
                  </div>
                </div>
              )}

              {event.location && (
                <div className="flex items-start gap-3 text-xs sm:text-sm text-[#242522]">
                  <MapPin className="w-4 h-4 text-[#A3A198] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#77766F] block text-xs">المكان:</span>
                    <span>{event.location}</span>
                  </div>
                </div>
              )}

              {event.instructor && (
                <div className="flex items-start gap-3 text-xs sm:text-sm text-[#242522]">
                  <User className="w-4 h-4 text-[#A3A198] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#77766F] block text-xs">المحاضر أو الشخص:</span>
                    <span>{event.instructor}</span>
                  </div>
                </div>
              )}

              {event.notes && (
                <div className="flex items-start gap-3 text-xs sm:text-sm text-[#242522]">
                  <FileText className="w-4 h-4 text-[#A3A198] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[#77766F] block text-xs">ملاحظات:</span>
                    <p className="text-[#242522] leading-relaxed mt-0.5">{event.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Controls */}
            <div className="space-y-2.5">
              {/* Complete Toggle */}
              <button
                onClick={() => {
                  sound.playCheck();
                  onToggleComplete(event.id);
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  event.completed
                    ? 'bg-[#E4DED4] text-[#243B35] hover:bg-[#d5cebf]'
                    : 'bg-[#6F8F78] text-white hover:bg-[#5f7d67]'
                }`}
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{event.completed ? 'تعليم كغير منجز (تراجع)' : 'تم الحضور / خلصت خلاص ✓'}</span>
              </button>

              {/* Reminder Toggle & Delete */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    sound.playTap();
                    onToggleReminder(event.id);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    event.reminder
                      ? 'bg-[#F4E8DE] border-[#C58B5C] text-[#C58B5C]'
                      : 'bg-white border-[#E4DED4] text-[#77766F]'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{event.reminder ? 'التنبيه مفعل' : 'تفعيل التنبيه'}</span>
                </button>

                <button
                  onClick={() => {
                    sound.playTap();
                    onDeleteEvent(event.id);
                    onClose();
                  }}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-white border border-[#E4DED4] text-[#B86B61] hover:bg-[#B86B61]/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المعاد</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
