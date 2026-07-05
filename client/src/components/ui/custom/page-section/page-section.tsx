import { cn } from '@/lib/utils'

type PageSectionProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/*
Usage:
<PageSection
  title="Students"
  description="Students enrolled in this course."
  actions={<Button>Add student</Button>}
>
  <StudentsTable />
</PageSection>
*/
export function PageSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  )
}
