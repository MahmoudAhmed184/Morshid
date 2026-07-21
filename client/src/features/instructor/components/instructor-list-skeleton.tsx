import { Skeleton } from '@/components/ui/skeleton'

const defaultRows = [0, 1, 2] as const

type InstructorListSkeletonProps = {
  rows?: number
  'aria-label'?: string
}

export function InstructorListSkeleton({
  rows = defaultRows.length,
  'aria-label': ariaLabel = 'Loading list rows',
}: InstructorListSkeletonProps) {
  return (
    <div className="space-y-3" aria-label={ariaLabel} role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-xl bg-background px-4 py-3.5 ring-1 ring-foreground/8"
        >
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
