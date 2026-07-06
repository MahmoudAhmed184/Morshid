import { cn } from '@/lib/utils'

type DetailFieldProps = {
  label: React.ReactNode
  value?: React.ReactNode
  emptyValue?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/*
Usage:
<DetailField label="Email" value={student.email} />
<DetailField label="Course ID" value={course.id} action={<CopyButton value={course.id} />} />
*/
export function DetailField({
  label,
  value,
  emptyValue = '-',
  action,
  className,
}: DetailFieldProps) {
  return (
    <div
      className={cn(
        'grid gap-1 border-b py-3 sm:grid-cols-[180px_1fr_auto] sm:items-center sm:gap-4',
        className,
      )}
    >
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{value ?? emptyValue}</dd>
      {action ? <div className="sm:justify-self-end">{action}</div> : null}
    </div>
  )
}
