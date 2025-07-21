import clsx from 'clsx'

export function SessionCardSkeleton() {
  return (
    <div
      className={clsx(
        "relative block p-6 h-full",
        "bg-zinc-900/50 backdrop-blur-sm",
        "border border-zinc-800",
        "rounded-xl",
        "h-[280px]",
        "grid grid-rows-[minmax(3rem,_1fr)_1.5rem_1.5rem_1.5rem_4rem]",
        "gap-3",
        "animate-pulse"
      )}
    >
      {/* Status Indicator Skeleton */}
      <div className="absolute top-4 right-4">
        <div className="w-2 h-2 bg-zinc-700 rounded-full" />
      </div>

      {/* Title Skeleton */}
      <div className="pr-20 min-h-[3rem]">
        <div className="h-5 bg-zinc-800 rounded w-3/4 mb-2" />
        <div className="h-5 bg-zinc-800 rounded w-1/2" />
      </div>

      {/* Project Path Skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-zinc-700 rounded" />
        <div className="h-3 bg-zinc-800 rounded flex-1" />
      </div>

      {/* Last Event Time Skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-zinc-700 rounded" />
        <div className="h-4 bg-zinc-800 rounded w-20" />
      </div>

      {/* Event Count Skeleton */}
      <div className="h-4 bg-zinc-800 rounded w-16" />

      {/* Message Carousel Skeleton - match h-16 (4rem) of real component */}
      <div className="h-16 overflow-hidden">
        <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
        <div className="h-4 bg-zinc-800 rounded w-5/6" />
      </div>
    </div>
  )
}

export function SessionGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SessionCardSkeleton key={index} />
      ))}
    </div>
  )
}