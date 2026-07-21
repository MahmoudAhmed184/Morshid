import { cn } from '@/lib/utils'

type StudentPageHeaderProps = {
  title: string
  eyebrow?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function StudentPageHeader({
  title,
  eyebrow = 'Student Workspace',
  description,
  action,
  className,
}: StudentPageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
