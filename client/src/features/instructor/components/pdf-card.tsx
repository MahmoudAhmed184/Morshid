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
  spin?: boolean
}

const statusPresentation: Record<string, StatusPresentation> = {
  ready: {
    variant: 'success',
    icon: CheckCircle2,
    chip: 'bg-success/10 text-success',
  },
  complete: {
    variant: 'success',
    icon: CheckCircle2,
    chip: 'bg-success/10 text-success',
  },
  processing: {
    variant: 'info',
    icon: Loader2,
    chip: 'bg-info/10 text-info',
    spin: true,
  },
  uploading: {
    variant: 'info',
    icon: Loader2,
    chip: 'bg-info/10 text-info',
    spin: true,
  },
  warning: {
    variant: 'warning',
    icon: TriangleAlert,
    chip: 'bg-warning/10 text-warning',
  },
  degraded: {
    variant: 'warning',
    icon: TriangleAlert,
    chip: 'bg-warning/10 text-warning',
  },
  failed: {
    variant: 'destructive',
    icon: XCircle,
    chip: 'bg-destructive/10 text-destructive',
  },
  error: {
    variant: 'destructive',
    icon: XCircle,
    chip: 'bg-destructive/10 text-destructive',
  },
}

const fallbackPresentation: StatusPresentation = {
  variant: 'secondary',
  icon: FileText,
  chip: 'bg-muted text-primary',
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
    <article
      className={cn(
        'flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3.5 text-left transition-colors hover:border-foreground/30',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-5',
          presentation.chip,
        )}
      >
        <Icon className={cn(presentation.spin && 'animate-spin')} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-foreground">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {status ? (
              <Badge variant={presentation.variant}>{status}</Badge>
            ) : null}
            {actions ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
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
        </div>
      </div>
    </article>
  )
}
