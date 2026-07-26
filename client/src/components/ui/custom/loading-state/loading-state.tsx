import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type LoadingStateProps = {
  variant?: 'cards' | 'table' | 'list'
  rows?: number
  className?: string
}

/*
Usage:
<LoadingState variant="table" rows={6} />
*/
export function LoadingState({
  variant = 'cards',
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'table') {
    return (
      <div className={cn('rounded-lg border', className)}>
        <div className="grid grid-cols-4 gap-3 border-b p-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-3 border-b p-3">
            {Array.from({ length: 4 }, (__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('grid gap-3', className)}>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-3 h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-3', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-lg border p-4">
          <Skeleton className="size-9" />
          <Skeleton className="mt-4 h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ))}
    </div>
  )
}
