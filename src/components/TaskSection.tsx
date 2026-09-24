import React, { useState } from 'react';
import { TaskItem, TaskPriority } from '../types';
import { Check, Plus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import { sound } from '../utils/audio';
import { EmptyState } from './EmptyState';

interface TaskSectionProps {
  tasks: TaskItem[];
  overdueTasks?: TaskItem[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (taskInput: Partial<TaskItem> & { title: string }) => Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask?: (taskId: string, newTitle: string) => void;
}

export const TaskSection: React.FC<TaskSectionProps> = ({
  tasks,
  overdueTasks = [],
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const pendingTasks = tasks.filter((t) => !t.completed && !overdueTasks.includes(t));
  const completedTasks = tasks.filter((t) => t.completed);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      sound.playPop();
      await onAddTask({ title: quickInput.trim(), priority: 'normal', category: 'عام', reminder: true });
      setQuickInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (task: TaskItem) => {
    sound.playTap();
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEdit = (taskId: string) => {
    if (editingTitle.trim() && onUpdateTask) {
      onUpdateTask(taskId, editingTitle.trim());
      sound.playPop();
    }
    setEditingTaskId(null);
  };

  const renderTask = (task: TaskItem) => {
      const isUrgent = task.priority === 'urgent';
      const isEditing = editingTaskId === task.id;

      return (
        <div
          key={task.id}
          className="group flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-[#F6F3EE] transition-colors border border-transparent hover:border-[#E4DED4]"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Custom Tactile Checkbox */}
            <button
              type="button"
              onClick={() => {
                sound.playCheck();
                onToggleTask(task.id);
              }}
              className="w-5 h-5 rounded-lg border-2 border-[#CEC4B5] hover:border-[#243B35] flex items-center justify-center transition-all duration-150 shrink-0 bg-white cursor-pointer"
              aria-label="تعليم المهمة كمنجزة"
            >
              <span className="w-2 h-2 rounded-full bg-transparent" />
            </button>

            {/* Task Title & Metadata */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(task.id);
                      if (e.key === 'Escape') setEditingTaskId(null);
                    }}
                    autoFocus
                    className="text-xs sm:text-sm bg-white border border-[#243B35] rounded-lg px-2 py-0.5 w-full text-[#242522] focus:outline-none"
                  />
                  <button
                    onClick={() => saveEdit(task.id)}
                    className="text-xs text-[#243B35] font-bold shrink-0 hover:underline"
                  >
                    حفظ
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs sm:text-sm font-medium text-[#242522] truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[#77766F] mt-0.5">
                    {isUrgent && (
                      <span className="text-[#B86B61] font-semibold">
                        عاجل جداً
                      </span>
                    )}
                    {task.due_time && (
                        <span className="text-[#7C5528] font-bold">
                            {task.due_time}
                        </span>
                    )}
                    {isUrgent && task.category && <span>·</span>}
                    {task.category && <span>{task.category}</span>}
                    {task.notes && (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[140px] text-[#A3A198]">{task.notes}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions (Edit / Delete) */}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {!isEditing && onUpdateTask && (
              <button
                onClick={() => startEdit(task)}
                className="text-[#A3A198] hover:text-[#243B35] p-1.5 rounded-lg cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#243B35] outline-none"
                title="تعديل"
                aria-label="تعديل المهمة"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                sound.playTap();
                onDeleteTask(task.id);
              }}
              className="text-[#A3A198] hover:text-[#B86B61] p-1.5 rounded-lg cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#B86B61] outline-none"
              title="حذف المهمة"
              aria-label="حذف المهمة"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
  };

  return (
    <section className="mt-8 mb-6 px-3 sm:px-4 max-w-3xl mx-auto">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C58B5C]" />
          <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
            لسه وراك · المهام المفتوحة
          </h2>
        </div>
        <span className="text-xs font-medium text-[#77766F]">
          {pendingTasks.length + overdueTasks.length} حاجات متبقية
        </span>
      </div>

      {/* Container Surface */}
      <div className="bg-white/80 border border-[#E4DED4] rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
        {/* Quick Inline Add Form */}
        <form onSubmit={handleQuickSubmit} className="mb-4">
          <div className="flex items-center gap-2 bg-[#F6F3EE] border border-[#E4DED4] rounded-2xl px-3 py-2 focus-within:border-[#243B35] focus-within:bg-white transition-all">
            <Plus className="w-4 h-4 text-[#A3A198] shrink-0" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="اكتب مهمة جديدة سريعة واضغط Enter..."
              className="w-full bg-transparent text-xs sm:text-sm text-[#242522] placeholder:text-[#A3A198] focus:outline-none"
            />
            {quickInput.trim() && (
              <button
                type="submit"
                className="text-xs font-semibold px-3 py-1 bg-[#243B35] text-[#F6F3EE] rounded-xl hover:bg-[#1b2d28] transition-colors shrink-0 cursor-pointer"
              >
                إضافة
              </button>
            )}
          </div>
        </form>

        {/* Overdue Tasks Section */}
        {overdueTasks.length > 0 && (
            <div className="mb-4 p-3 rounded-2xl bg-[#B86B61]/5 border border-[#B86B61]/20">
                <h3 className="text-xs font-bold text-[#B86B61] mb-2 px-1">متأخرة ⚠️</h3>
                <div className="space-y-2">
                    {overdueTasks.map(renderTask)}
                </div>
            </div>
        )}

        {/* Pending Tasks List or Empty State */}
        {pendingTasks.length === 0 && completedTasks.length === 0 && overdueTasks.length === 0 ? (
          <EmptyState
            type="no-tasks"
            customTitle="مفيش مهام مفتوحة حالياً"
            customSubtitle="كل حاجة متظبطة وخلصانة، دماغك رايقة 😌"
            compact
          />
        ) : (
          <div className="space-y-2">
            {pendingTasks.map(renderTask)}
          </div>
        )}

        {/* Completed Tasks Toggle Section */}
        {completedTasks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#E4DED4]">
            <button
              onClick={() => {
                sound.playTap();
                setShowCompleted(!showCompleted);
              }}
              className="text-xs font-semibold text-[#77766F] hover:text-[#243B35] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#6F8F78]" />
              <span>
                {showCompleted ? 'إخفاء المهام المخلصة' : `المهام اللي خلصت (${completedTasks.length})`}
              </span>
            </button>

            {showCompleted && (
              <div className="space-y-1.5 mt-2.5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F6F3EE]/50 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playCheck();
                          onToggleTask(task.id);
                        }}
                        className="w-5 h-5 rounded-lg bg-[#6F8F78] border border-[#6F8F78] flex items-center justify-center text-white shrink-0 cursor-pointer"
                        title="إلغاء الإنجاز"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className="text-xs text-[#77766F] line-through truncate">
                        {task.title}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="text-[#A3A198] hover:text-[#B86B61] p-1 cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
