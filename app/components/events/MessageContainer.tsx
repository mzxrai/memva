import { type ReactNode } from 'react'
import clsx from 'clsx'

interface MessageContainerProps {
  children: ReactNode
  className?: string
}

export function MessageContainer({ children, className }: MessageContainerProps) {
  return (
    <div className={clsx(
      'p-4',
      className
    )}>
      {children}
    </div>
  )
}