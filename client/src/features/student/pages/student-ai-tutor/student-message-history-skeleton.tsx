import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const skeletonMessages = [
  { id: 'student', isStudent: true, width: 'w-3/5' },
  { id: 'assistant', isStudent: false, width: 'w-4/5' },
] as const

export function StudentMessageHistorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading conversation history"
      aria-busy="true"
      className="w-full space-y-5"
    >
      {skeletonMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex gap-3',
            message.isStudent ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton
            className={cn(
              'rounded-2xl px-4 py-3',
              message.isStudent ? 'rounded-tr-md' : 'rounded-tl-md',
              message.width,
            )}
          >
            <div className="h-4 w-full rounded bg-background/50" />
            <div className="mt-2 h-4 w-2/3 rounded bg-background/50" />
          </Skeleton>
        </div>
      ))}
    </div>
  )
}
