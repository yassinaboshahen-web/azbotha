/**
 * Centralized Motion Tokens & Transition Helpers
 * Respects `prefers-reduced-motion` and provides smooth micro-interactions
 */

export const MOTION_DURATIONS = {
  instant: 100,
  fast: 150,
  normal: 250,
  moderate: 350,
  slow: 500,
} as const;

export const MOTION_EASINGS = {
  springGentle: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  scaleIn: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/**
 * Returns Tailwind transition classes tailored for zoom & layout shifts
 */
export const getZoomTransitionClass = (level: 'day' | 'week' | 'month'): string => {
  return 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';
};
