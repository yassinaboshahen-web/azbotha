import React from 'react';
import { ChevronRight, ChevronLeft, type LucideIcon } from 'lucide-react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { px: number; stroke: number }> = {
  xs: { px: 14, stroke: 2.5 },
  sm: { px: 16, stroke: 2 },
  md: { px: 20, stroke: 2 },
  lg: { px: 24, stroke: 2 },
  xl: { px: 28, stroke: 2 },
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  strokeWidth?: number;
  className?: string;
  color?: string;
  'aria-hidden'?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 'md',
  strokeWidth,
  className = '',
  color,
  'aria-hidden': ariaHidden = true,
}) => {
  let pixelSize = 20;
  let defaultStroke = 2;

  if (typeof size === 'number') {
    pixelSize = size;
    defaultStroke = size <= 14 ? 2.5 : 2;
  } else if (size in SIZE_MAP) {
    pixelSize = SIZE_MAP[size].px;
    defaultStroke = SIZE_MAP[size].stroke;
  }

  const finalStroke = strokeWidth !== undefined ? strokeWidth : defaultStroke;

  return (
    <IconComponent
      size={pixelSize}
      strokeWidth={finalStroke}
      className={`shrink-0 ${className}`}
      color={color}
      aria-hidden={ariaHidden}
    />
  );
};

export interface IconLabelProps {
  icon: LucideIcon;
  label: React.ReactNode;
  size?: IconSize;
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  strokeWidth?: number;
}

const GAP_MAP: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'gap-1',
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-3',
};

export const IconLabel: React.FC<IconLabelProps> = ({
  icon,
  label,
  size = 'sm',
  gap = 'sm',
  className = '',
  iconClassName = '',
  textClassName = '',
  strokeWidth,
}) => {
  return (
    <span className={`inline-flex items-center ${GAP_MAP[gap]} ${className}`}>
      <Icon icon={icon} size={size} strokeWidth={strokeWidth} className={iconClassName} />
      <span className={textClassName}>{label}</span>
    </span>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string; // Required for accessibility (aria-label)
  size?: IconSize;
  variant?: 'ghost' | 'filled' | 'outline' | 'subtle';
  shape?: 'circle' | 'square';
  className?: string;
  iconClassName?: string;
  strokeWidth?: number;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  shape = 'circle',
  className = '',
  iconClassName = '',
  strokeWidth,
  type = 'button',
  disabled,
  ...rest
}) => {
  const variantStyles = {
    ghost: 'text-[#77766F] hover:text-[#243B35] hover:bg-[#F6F3EE] active:bg-[#EAE3D5]',
    filled: 'bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] active:scale-95 shadow-xs',
    outline: 'border border-[#E4DED4] bg-white hover:bg-[#F6F3EE] text-[#243B35]',
    subtle: 'bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] hover:bg-[#E4DED4]',
  };

  const shapeStyles = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      className={`min-w-[44px] min-h-[44px] p-2.5 grid place-items-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#243B35] focus-visible:ring-offset-1 outline-none select-none ${shapeStyles} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      <Icon icon={icon} size={size} strokeWidth={strokeWidth} className={iconClassName} />
    </button>
  );
};

export interface NavChevronProps {
  direction: 'prev' | 'next' | 'forward';
  size?: IconSize;
  className?: string;
  strokeWidth?: number;
}

/**
 * RTL-Aware Navigation Chevron:
 * - 'prev' (السابق): points to the right (ChevronRight in RTL).
 * - 'next' (التالي): points to the left (ChevronLeft in RTL).
 * - 'forward' (فتح / تفاصيل): points to the left (ChevronLeft in RTL).
 */
export const NavChevron: React.FC<NavChevronProps> = ({
  direction,
  size = 'sm',
  className = '',
  strokeWidth = 2,
}) => {
  const IconComponent = direction === 'prev' ? ChevronRight : ChevronLeft;
  return <Icon icon={IconComponent} size={size} strokeWidth={strokeWidth} className={className} />;
};
