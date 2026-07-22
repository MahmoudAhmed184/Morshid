import { FileText, MoreHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type PdfCardProps = {
  title: string
  description?: React.ReactNode
  status?: React.ReactNode
  details?: React.ReactNode
  message?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PdfCard({
  title,
  description,
  status,
  details,
  message,
  actions,
  className,
}: PdfCardProps) {
  return (
    <article
      className={cn(
        'flex items-start gap-3 rounded-[8px] border border-border bg-background px-4 py-3 text-left',
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-muted text-primary">
        <FileText className="size-5" aria-hidden />
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
            {details ? <div className="mt-2">{details}</div> : null}
            {message ? <div className="mt-3">{message}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof status === 'string' ? (
              <Badge variant="outline">{status}</Badge>
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
