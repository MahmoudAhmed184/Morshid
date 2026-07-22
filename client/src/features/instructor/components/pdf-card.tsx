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
  description?: React.ReactNode
  status?: React.ReactNode
  statusKey?: string
  details?: React.ReactNode
  message?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PdfCard({
  title,
  description,
  status,
  statusKey,
  details,
  message,
  actions,
  className,
}: PdfCardProps) {
  const presentation = presentationFor(
    statusKey ?? (typeof status === 'string' ? status : undefined),
  )
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
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-foreground">
              {title}
            </h3>
            {description ? (
              <div className="footnote mt-1 truncate font-mono">
                {description}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof status === 'string' ? (
              <Badge variant={presentation.variant}>{status}</Badge>
            ) : (
              status
            )}
            {actions ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="-mt-1 -mr-1"
                      aria-label={`Open actions for ${title}`}
                    />
                  }
                >
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        {details ? <div className="mt-3">{details}</div> : null}
        {message ? <div className="mt-3">{message}</div> : null}
      </div>
    </Card>
  )
}
