// Design system constants inspired by Linear's minimal aesthetic

// Color palette - primarily grayscale with subtle accents
export const colors = {
  // Background colors
  background: {
    primary: 'bg-zinc-950',
    secondary: 'bg-zinc-900',
    tertiary: 'bg-zinc-900/50',
    hover: 'hover:bg-zinc-900/70',
    active: 'bg-zinc-800',
  },
  
  // Border colors
  border: {
    subtle: 'border-zinc-800',
    default: 'border-zinc-700',
    strong: 'border-zinc-600',
    hover: 'hover:border-zinc-600',
  },
  
  // Text colors
  text: {
    primary: 'text-zinc-100',
    secondary: 'text-zinc-400',
    tertiary: 'text-zinc-500',
    muted: 'text-zinc-600',
  },
  
  // Accent colors - used sparingly
  accent: {
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    green: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    red: {
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
  },
} as const

// Typography
export const typography = {
  // Font families
  font: {
    sans: 'font-sans',
    mono: 'font-mono',
  },
  
  // Font sizes
  size: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  },
  
  // Font weights
  weight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
  },
  
  // Line heights
  leading: {
    tight: 'leading-tight',
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
  },
} as const

// Spacing system - consistent spacing scale
export const spacing = {
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
  xl: 'p-6',
  
  // Margin/padding utilities
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  },
  
  margin: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-3',
    lg: 'm-4',
  },
} as const

// Border radius
export const radius = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const

// Shadows - subtle depth
export const shadow = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  default: 'shadow',
  md: 'shadow-md',
  glow: 'shadow-zinc-950/50',
} as const

// Transitions
export const transition = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-200',
  slow: 'transition-all duration-300',
} as const

// Layout utilities
export const layout = {
  container: 'container mx-auto max-w-7xl px-4',
  messageContainer: 'mb-4 group relative',
  messageContent: 'rounded-lg border p-4',
} as const

// Interactive states
export const interactive = {
  button: 'cursor-pointer select-none active:scale-[0.98]',
  link: 'hover:underline underline-offset-2',
  focus: 'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-950',
} as const

// Icon sizes
export const iconSize = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const