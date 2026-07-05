import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorStateProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  retryLabel?: string
  onRetry?: () => void
  isRetrying?: boolean
  action?: React.ReactNode
  className?: string
}

/*
Usage:
<ErrorState
  description="Courses could not be loaded."
  onRetry={() => refetch()}
  isRetrying={isFetching}
/>
*/
export function ErrorState({
  title = 'Something went wrong',
  description = 'The request could not be completed. Try again or come back later.',
  retryLabel = 'Retry',
  onRetry,
  isRetrying = false,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-64 flex-col items-center justify-center rounded-lg border bg-card px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <TriangleAlertIcon />
      </div>
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {onRetry || action ? (
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          {action}
          {onRetry ? (
            <Button
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCwIcon
                className={isRetrying ? 'animate-spin' : undefined}
              />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
