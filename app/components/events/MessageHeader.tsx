import { type ReactNode, type ComponentType } from 'react'
import { colors, typography, iconSize } from '../../constants/design'
import clsx from 'clsx'

interface MessageHeaderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  children?: ReactNode
  className?: string
  iconClassName?: string
  titleClassName?: string
}

export function MessageHeader({ icon: Icon, title, children, className, iconClassName, titleClassName }: MessageHeaderProps) {
  return (
    <div className={clsx(
      'flex items-center gap-2 mb-3',
      className
    )}>
      <Icon className={clsx(iconSize.sm, colors.text.tertiary, iconClassName)} />
      <span className={clsx(
        typography.size.sm,
        typography.weight.medium,
        colors.text.tertiary,
        titleClassName
      )}>
        {title}
      </span>
      {children}
    </div>
  )
}