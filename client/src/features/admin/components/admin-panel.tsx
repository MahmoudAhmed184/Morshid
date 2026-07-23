import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type AdminPanelProps = React.ComponentProps<typeof Card>

/**
 * Bordered surface for admin tables and dashboard panels. Composes the stock
 * `Card` primitive as a bare frame: its consumers are full-bleed (tables,
 * toolbars) or supply their own slot padding, so the card's default vertical
 * padding and gap are zeroed out here (consumers add padding via `className`).
 */
export function AdminPanel({ className, ...props }: AdminPanelProps) {
  return <Card className={cn('gap-0 py-0', className)} {...props} />
}
