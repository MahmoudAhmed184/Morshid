import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const skeletonMessages = [
  { id: 'assistant', isStudent: false, lines: ['w-4/5', 'w-3/5'] },
  { id: 'student', isStudent: true, lines: ['w-2/3'] },
  { id: 'assistant-2', isStudent: false, lines: ['w-11/12', 'w-3/4', 'w-2/5'] },
] as const

export function StudentMessageHistorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading conversation history"
      aria-busy="true"
      className="w-full space-y-6"
    >
      {skeletonMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'flex items-end gap-3',
            message.isStudent ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div
            className={cn(
              'flex max-w-[min(90%,44rem)] flex-col gap-2 rounded-md border border-border px-4 py-3.5',
              message.isStudent ? 'bg-accent' : 'bg-card',
            )}
          >
            {message.lines.map((line, index) => (
              <Skeleton
                key={index}
                className={cn('h-3.5 rounded-sm bg-foreground/10', line)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
