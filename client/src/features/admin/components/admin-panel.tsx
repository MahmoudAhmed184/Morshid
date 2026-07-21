import { cn } from '@/lib/utils'

type AdminPanelProps = React.ComponentProps<'section'>

export function AdminPanel({ className, ...props }: AdminPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-foreground/8 bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}
