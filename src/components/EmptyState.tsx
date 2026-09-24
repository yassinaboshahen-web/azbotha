import React from 'react';
import { Calendar, CheckSquare, Plus, Sparkles, BellOff, Coffee, Clock } from 'lucide-react';
import { sound } from '../utils/audio';

export type EmptyStateType =
  | 'no-events'
  | 'no-tasks'
  | 'no-upcoming'
  | 'no-tomorrow'
  | 'no-notifications'
  | 'no-week-data'
  | 'generic';

interface EmptyStateProps {
  type: EmptyStateType;
  customTitle?: string;
  customSubtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  customTitle,
  customSubtitle,
  actionLabel,
  onAction,
  compact = false,
}) => {
  const configs: Record<
    EmptyStateType,
    { title: string; subtitle: string; icon: React.ReactNode; defaultAction?: string }
  > = {
    'no-events': {
      title: 'مفيش مواعيد النهارده.',
      subtitle: 'لسه يومك فاضي 😌. ابدأ بحاجة بسيطة وحط أول حاجة وراك.',
      icon: <Calendar className="w-5 h-5 text-[#243B35]" />,
      defaultAction: '+ ضيف معاد جديد',
    },
    'no-tasks': {
      title: 'كله خلص، عاش 👏',
      subtitle: 'مفيش مهام مفتوحة حالياً، دماغك رايقة ومستريحة.',
      icon: <CheckSquare className="w-5 h-5 text-[#6F8F78]" />,
      defaultAction: '+ سجل مهمة سريعة',
    },
    'no-upcoming': {
      title: 'مفيش حاجة جاية دلوقتي',
      subtitle: 'خلصت كل مواعيد الفترة دي أو لسه يومك هادي.',
      icon: <Clock className="w-5 h-5 text-[#C58B5C]" />,
    },
    'no-tomorrow': {
      title: 'بكرة لسه فاضي',
      subtitle: 'مفيش مواعيد أو تسليمات متسجلة لبكرة حتى الآن.',
      icon: <Coffee className="w-5 h-5 text-[#A3A198]" />,
      defaultAction: 'خطط لبكرة من دلوقتي',
    },
    'no-notifications': {
      title: 'مفيش تنبيهات جديدة دلوقتي',
      subtitle: 'دماغك رايقة وكل مواعيدك ومهامك متأمنة 😌',
      icon: <BellOff className="w-5 h-5 text-[#A3A198]" />,
    },
    'no-week-data': {
      title: 'الأسبوع ده لسه هادي جداً',
      subtitle: 'مفيش التزامات كبيرة متسجلة في الفترة دي.',
      icon: <Sparkles className="w-5 h-5 text-[#C58B5C]" />,
      defaultAction: 'ضيف مواعيد للأسبوع',
    },
    generic: {
      title: 'لسه يومك فاضي 😌',
      subtitle: 'ابدأ بحاجة بسيطة وحط أول حاجة وراك.',
      icon: <Sparkles className="w-5 h-5 text-[#77766F]" />,
      defaultAction: 'إضافة جديد',
    },
  };

  const current = configs[type] || configs.generic;
  const title = customTitle || current.title;
  const subtitle = customSubtitle || current.subtitle;
  const finalActionLabel = actionLabel || current.defaultAction;

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-6 px-4 bg-white/40 border border-dashed border-[#E4DED4] rounded-2xl">
        <div className="w-8 h-8 rounded-full bg-[#E4DED4]/60 flex items-center justify-center mb-2">
          {current.icon}
        </div>
        <p className="text-xs font-bold text-[#243B35] mb-0.5">{title}</p>
        <p className="text-[11px] text-[#77766F] max-w-xs leading-relaxed">{subtitle}</p>
        {finalActionLabel && onAction && (
          <button
            onClick={() => {
              sound.playTap();
              onAction();
            }}
            className="mt-3 px-3 py-1.5 rounded-xl bg-[#243B35] text-[#F6F3EE] text-xs font-bold hover:bg-[#1b2d28] transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{finalActionLabel}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 bg-white/60 border border-dashed border-[#E4DED4] rounded-3xl my-3">
      <div className="w-12 h-12 rounded-2xl bg-[#F6F3EE] border border-[#E4DED4] flex items-center justify-center mb-3.5 shadow-xs">
        {current.icon}
      </div>
      <h3 className="text-sm sm:text-base font-bold text-[#243B35] mb-1">{title}</h3>
      <p className="text-xs text-[#77766F] max-w-sm leading-relaxed mb-4">{subtitle}</p>
      {finalActionLabel && onAction && (
        <button
          onClick={() => {
            sound.playPop();
            onAction();
          }}
          className="px-4 py-2 rounded-2xl bg-[#243B35] text-[#F6F3EE] text-xs sm:text-sm font-bold hover:bg-[#1b2d28] transition-all shadow-xs hover:shadow-md cursor-pointer inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-[#D8C3A5]" />
          <span>{finalActionLabel}</span>
        </button>
      )}
    </div>
  );
};
