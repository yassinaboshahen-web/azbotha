import React from 'react';
import {
  GraduationCap,
  Users,
  Presentation,
  Dumbbell,
  Coffee,
  BookOpen,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { EventCategory } from '../types';

export interface CategoryStyle {
  id: EventCategory;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  lecture: {
    id: 'lecture',
    label: 'محاضرة',
    color: '#2E6B56',
    bgColor: '#EAF3EE',
    borderColor: '#C7E0D3',
    icon: GraduationCap,
  },
  section: {
    id: 'section',
    label: 'سكشن',
    color: '#35657E',
    bgColor: '#EBF2F6',
    borderColor: '#C6DAE4',
    icon: Users,
  },
  meeting: {
    id: 'meeting',
    label: 'ميتينج',
    color: '#C58B5C',
    bgColor: '#F9F1EB',
    borderColor: '#EBD4C3',
    icon: Presentation,
  },
  workout: {
    id: 'workout',
    label: 'تمرين',
    color: '#D97736',
    bgColor: '#FDF1E9',
    borderColor: '#F6D5BF',
    icon: Dumbbell,
  },
  personal: {
    id: 'personal',
    label: 'شخصي',
    color: '#8E5D87',
    bgColor: '#F5EDF4',
    borderColor: '#E3CFE1',
    icon: Coffee,
  },
  study: {
    id: 'study',
    label: 'مذاكرة',
    color: '#6F8F78',
    bgColor: '#F0F5F1',
    borderColor: '#D4E2D8',
    icon: BookOpen,
  },
  custom: {
    id: 'custom',
    label: 'معاد',
    color: '#64748B',
    bgColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    icon: Calendar,
  },
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  lecture: CATEGORY_STYLES.lecture.color,
  section: CATEGORY_STYLES.section.color,
  meeting: CATEGORY_STYLES.meeting.color,
  workout: CATEGORY_STYLES.workout.color,
  personal: CATEGORY_STYLES.personal.color,
  study: CATEGORY_STYLES.study.color,
  custom: CATEGORY_STYLES.custom.color,
};

export const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  lecture: CATEGORY_STYLES.lecture.icon,
  section: CATEGORY_STYLES.section.icon,
  meeting: CATEGORY_STYLES.meeting.icon,
  workout: CATEGORY_STYLES.workout.icon,
  personal: CATEGORY_STYLES.personal.icon,
  study: CATEGORY_STYLES.study.icon,
  custom: CATEGORY_STYLES.custom.icon,
};

export function getCategoryStyle(category?: string | null): CategoryStyle {
  if (category && category in CATEGORY_STYLES) {
    return CATEGORY_STYLES[category as EventCategory];
  }
  return CATEGORY_STYLES.custom;
}
