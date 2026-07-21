import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type FeatureCardProps = {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'group/feature h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/20',
        className,
      )}
    >
      <CardHeader className="space-y-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors duration-300 group-hover/feature:bg-primary/15">
          <Icon className="size-5" aria-hidden />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
