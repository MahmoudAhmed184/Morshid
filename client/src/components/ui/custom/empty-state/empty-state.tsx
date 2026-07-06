import { InboxIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
}

/*
Usage:
<EmptyState
  title="No courses yet"
  description="Create your first course to start adding lessons."
  action={<Button>Create course</Button>}
/>
*/
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon ?? <InboxIcon />}
      </div>
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </div>
  )
}
