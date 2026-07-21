import {
  CheckCircle2,
  FileText,
  Loader2,
  MoreHorizontal,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { badgeVariants } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { VariantProps } from 'class-variance-authority'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

type StatusPresentation = {
  variant: BadgeVariant
  icon: LucideIcon
  chip: string
  bar: string
  spin?: boolean
}

const statusPresentation: Record<string, StatusPresentation> = {
  ready: {
    variant: 'success',
    icon: CheckCircle2,
    chip: 'bg-success/10 text-success',
    bar: 'bg-success',
  },
  complete: {
    variant: 'success',
    icon: CheckCircle2,
    chip: 'bg-success/10 text-success',
    bar: 'bg-success',
  },
  processing: {
    variant: 'info',
    icon: Loader2,
    chip: 'bg-info/10 text-info',
    bar: 'bg-info',
    spin: true,
  },
  uploading: {
    variant: 'info',
    icon: Loader2,
    chip: 'bg-info/10 text-info',
    bar: 'bg-info',
    spin: true,
  },
  warning: {
    variant: 'warning',
    icon: TriangleAlert,
    chip: 'bg-warning/10 text-warning',
    bar: 'bg-warning',
  },
  degraded: {
    variant: 'warning',
    icon: TriangleAlert,
    chip: 'bg-warning/10 text-warning',
    bar: 'bg-warning',
  },
  failed: {
    variant: 'destructive',
    icon: XCircle,
    chip: 'bg-destructive/10 text-destructive',
    bar: 'bg-destructive',
  },
  error: {
    variant: 'destructive',
    icon: XCircle,
    chip: 'bg-destructive/10 text-destructive',
    bar: 'bg-destructive',
  },
}

const fallbackPresentation: StatusPresentation = {
  variant: 'secondary',
  icon: FileText,
  chip: 'bg-primary/10 text-primary',
  bar: 'bg-muted-foreground',
}

function presentationFor(status?: string): StatusPresentation {
  if (!status) {
    return fallbackPresentation
  }

  return statusPresentation[status.toLowerCase()] ?? fallbackPresentation
}

type PdfCardProps = {
  title: string
  description?: string
  status?: string
  actions?: React.ReactNode
  className?: string
}

export function PdfCard({
  title,
  description,
  status,
  actions,
  className,
}: PdfCardProps) {
  const presentation = presentationFor(status)
  const Icon = presentation.icon

  return (
    <Card
      className={cn('hover-float relative flex flex-row gap-3 p-5', className)}
    >
      <span
        className={cn(
          'absolute inset-y-5 left-0 w-0.5 rounded-full',
          presentation.bar,
        )}
        aria-hidden
      />
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
          presentation.chip,
        )}
      >
        <Icon className={cn(presentation.spin && 'animate-spin')} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-mono text-sm font-medium text-foreground">
            {title}
          </h3>
          {actions ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1 shrink-0"
                    aria-label={`Open actions for ${title}`}
                  />
                }
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {description ? (
          <p className="footnote mt-1 line-clamp-2 leading-5">{description}</p>
        ) : null}
        {status ? (
          <div className="mt-3">
            <Badge variant={presentation.variant}>{status}</Badge>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
