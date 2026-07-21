import { Skeleton } from '@/components/ui/skeleton'

const skeletonRows = ['first', 'second', 'third'] as const

interface StudentSessionNavigationSkeletonProps {
  label?: string
}

export function StudentSessionNavigationSkeleton({
  label = 'Loading conversations',
}: StudentSessionNavigationSkeletonProps) {
  return (
    <div role="status" aria-label={label} className="space-y-1">
      {skeletonRows.map((row) => (
        <div
          key={row}
          className="flex min-h-16 flex-col justify-center rounded-md px-4 py-2.5"
        >
          <Skeleton className="h-4 w-3/4 rounded-full" />
          <Skeleton className="mt-2 h-3 w-2/5 rounded-full" />
        </div>
      ))}
    </div>
  )
}
