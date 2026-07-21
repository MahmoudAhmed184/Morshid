import { cn } from '@/lib/utils'

type AdminPanelProps = React.ComponentProps<'section'>

export function AdminPanel({ className, ...props }: AdminPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-foreground/8',
        className,
      )}
      {...props}
    />
  )
}
