import { Skeleton } from '@/components/ui/skeleton'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'

/** Placeholder for the outlet while a child route is still resolving. */
export function InstructorShellContentFallback() {
  return (
    <div
      className="flex flex-col gap-5"
      role="status"
      aria-label="Loading instructor page"
    >
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <InstructorListSkeleton aria-label="Loading page content" />
    </div>
  )
}
