import { cn } from '@/lib/utils'

type AdminPanelProps = React.ComponentProps<'section'>

export function AdminPanel({ className, ...props }: AdminPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-md border border-border bg-card text-card-foreground',
        className,
      )}
      {...props}
    />
  )
}
