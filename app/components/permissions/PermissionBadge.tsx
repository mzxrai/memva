interface PermissionBadgeProps {
  count: number
  className?: string
}

export default function PermissionBadge({ count, className = '' }: PermissionBadgeProps) {
  if (count === 0) {
    return null
  }

  const displayCount = count > 9 ? '9+' : count.toString()
  const ariaLabel = `${count} pending permission request${count === 1 ? '' : 's'}`

  return (
    <span 
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-red-500 rounded-full ${className}`}
      aria-label={ariaLabel}
    >
      {displayCount}
    </span>
  )
}