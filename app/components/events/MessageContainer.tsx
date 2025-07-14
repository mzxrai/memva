import { type ReactNode } from 'react'
import { colors, radius } from '../../constants/design'
import clsx from 'clsx'

interface MessageContainerProps {
  children: ReactNode
  className?: string
}

export function MessageContainer({ children, className }: MessageContainerProps) {
  return (
    <div className={clsx(
      colors.background.secondary,
      colors.border.subtle,
      'border',
      radius.lg,
      'p-4',
      className
    )}>
      {children}
    </div>
  )
}