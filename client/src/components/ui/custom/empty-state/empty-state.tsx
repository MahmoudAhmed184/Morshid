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
        'relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center',
        className,
      )}
    >
      <div
        className="bg-star-field pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        aria-hidden
      />
      <div className="relative mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 [&_svg]:size-5">
        {icon ?? <InboxIcon />}
      </div>
      <h2 className="relative text-base font-medium text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="relative mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="relative mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </div>
  )
}
