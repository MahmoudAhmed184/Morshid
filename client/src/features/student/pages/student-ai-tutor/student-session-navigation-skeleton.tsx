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
        <div key={row} className="rounded-md px-3 py-2.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}
