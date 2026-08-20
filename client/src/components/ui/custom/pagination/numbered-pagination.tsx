import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NumberedPaginationProps = {
  page: number
  totalPages: number
  totalCount: number
  limit: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
  itemName?: string
}

type PageItem = number | 'ellipsis'

function getPaginationItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total]
  }

  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

export function NumberedPagination({
  page,
  totalPages,
  totalCount,
  limit,
  onPageChange,
  disabled = false,
  className,
  itemName = 'items',
}: NumberedPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)
  const paginationItems = getPaginationItems(safePage, safeTotalPages)

  const from = totalCount === 0 ? 0 : (safePage - 1) * limit + 1
  const to = Math.min(safePage * limit, totalCount)

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col items-center justify-between gap-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span> to{' '}
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{totalCount}</span>{' '}
        {itemName}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1 || disabled}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1" role="list">
          {paginationItems.map((item, index) => {
            if (item === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-xs text-muted-foreground select-none"
                  aria-hidden
                >
                  …
                </span>
              )
            }

            const isCurrent = item === safePage

            return (
              <Button
                key={item}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                className="size-8 p-0 text-xs"
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-label={`Page ${item}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {item}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          disabled={safePage >= safeTotalPages || disabled}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
