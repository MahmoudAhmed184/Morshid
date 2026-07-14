import { cn } from '@/lib/utils'

type AdminPanelProps = React.ComponentProps<'section'>

export function AdminPanel({ className, ...props }: AdminPanelProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
