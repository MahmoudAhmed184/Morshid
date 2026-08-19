import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface NumberedPaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
}

export function NumberedPagination({
  page,
  totalPages,
  total,
  pageSize = 20,
  onPageChange,
  disabled = false,
  className,
}: NumberedPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)
  const startItem = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endItem = Math.min(safePage * pageSize, total)

  const pages = getPaginationPages(safePage, safeTotalPages)

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn(
        'flex flex-col items-center justify-between gap-4 border-t border-border/60 px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <div className="text-xs text-muted-foreground tabular-nums">
        {total === 0 ? (
          '0 results'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-foreground">{startItem}</span>–
            <span className="font-medium text-foreground">{endItem}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> results
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
          className="h-8 gap-1 px-2.5 text-xs"
        >
          <ChevronLeftIcon className="size-3.5" />
          <span>Previous</span>
        </Button>

        {/* Mobile Page indicator */}
        <div className="flex items-center px-2 text-xs font-medium text-muted-foreground sm:hidden tabular-nums">
          Page {safePage} of {safeTotalPages}
        </div>

        {/* Desktop Numbered buttons */}
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((item, index) => {
            if (typeof item === 'string') {
              return (
                <span
                  key={`ellipsis-${index.toString()}`}
                  className="flex size-8 items-center justify-center text-xs text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              )
            }

            const isCurrent = item === safePage

            return (
              <Button
                key={item}
                type="button"
                variant={isCurrent ? 'default' : 'outline'}
                size="icon-sm"
                disabled={disabled}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item.toString()}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'size-8 text-xs font-medium tabular-nums',
                  isCurrent && 'pointer-events-none',
                )}
              >
                {item}
              </Button>
            )
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
          className="h-8 gap-1 px-2.5 text-xs"
        >
          <span>Next</span>
          <ChevronRightIcon className="size-3.5" />
        </Button>
      </div>
    </nav>
  )
}

function getPaginationPages(
  currentPage: number,
  totalPages: number,
): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages]
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis-start',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ]
  }

  return [
    1,
    'ellipsis-start',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis-end',
    totalPages,
  ]
}
