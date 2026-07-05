import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

const ELLIPSIS = 'ellipsis'

type PaginationPage = number | typeof ELLIPSIS

type CustomPaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  siblingCount?: number
  boundaryCount?: number
  disabled?: boolean
  className?: string
  showSummary?: boolean
  totalItems?: number
  pageSize?: number
}

function range(start: number, end: number) {
  const length = end - start + 1

  return Array.from({ length }, (_, index) => start + index)
}

function getPaginationPages({
  page,
  pageCount,
  siblingCount,
  boundaryCount,
}: Required<
  Pick<
    CustomPaginationProps,
    'page' | 'pageCount' | 'siblingCount' | 'boundaryCount'
  >
>): PaginationPage[] {
  const totalVisible = boundaryCount * 2 + siblingCount * 2 + 3

  if (pageCount <= totalVisible) {
    return range(1, pageCount)
  }

  const leftSibling = Math.max(page - siblingCount, boundaryCount + 2)
  const rightSibling = Math.min(
    page + siblingCount,
    pageCount - boundaryCount - 1,
  )
  const showLeftEllipsis = leftSibling > boundaryCount + 2
  const showRightEllipsis = rightSibling < pageCount - boundaryCount - 1
  const pages: PaginationPage[] = [...range(1, boundaryCount)]

  if (showLeftEllipsis) {
    pages.push(ELLIPSIS)
  } else {
    pages.push(...range(boundaryCount + 1, leftSibling - 1))
  }

  pages.push(...range(leftSibling, rightSibling))

  if (showRightEllipsis) {
    pages.push(ELLIPSIS)
  } else {
    pages.push(...range(rightSibling + 1, pageCount - boundaryCount))
  }

  pages.push(...range(pageCount - boundaryCount + 1, pageCount))

  return pages
}

function getSummaryText(page: number, pageSize: number, totalItems: number) {
  if (totalItems === 0) {
    return '0 results'
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return `${start}-${end} of ${totalItems}`
}

export function CustomPagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  disabled = false,
  className,
  showSummary = false,
  totalItems,
  pageSize,
}: CustomPaginationProps) {
  const currentPage = Math.min(Math.max(page, 1), Math.max(pageCount, 1))
  const hasPages = pageCount > 1
  const pages = getPaginationPages({
    page: currentPage,
    pageCount: Math.max(pageCount, 1),
    siblingCount,
    boundaryCount,
  })
  const canGoPrevious = currentPage > 1 && !disabled
  const canGoNext = currentPage < pageCount && !disabled
  const summary =
    showSummary && totalItems !== undefined && pageSize !== undefined
      ? getSummaryText(currentPage, pageSize, totalItems)
      : undefined

  if (!hasPages && !summary) {
    return null
  }

  const changePage = (nextPage: number) => {
    if (disabled || nextPage === currentPage || nextPage < 1) {
      return
    }

    if (nextPage > pageCount) {
      return
    }

    onPageChange(nextPage)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {summary ? (
        <p className="text-sm text-muted-foreground">{summary}</p>
      ) : (
        <span />
      )}

      {hasPages && (
        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                className="pl-1.5"
                disabled={!canGoPrevious}
                onClick={() => changePage(currentPage - 1)}
                aria-label="Go to previous page"
              >
                <ChevronLeftIcon data-icon="inline-start" />
                <span className="hidden sm:block">Previous</span>
              </Button>
            </PaginationItem>

            {pages.map((paginationPage, index) => (
              <PaginationItem key={`${paginationPage}-${index}`}>
                {paginationPage === ELLIPSIS ? (
                  <PaginationEllipsis />
                ) : (
                  <Button
                    variant={
                      paginationPage === currentPage ? 'outline' : 'ghost'
                    }
                    size="icon"
                    disabled={disabled}
                    onClick={() => changePage(paginationPage)}
                    aria-current={
                      paginationPage === currentPage ? 'page' : undefined
                    }
                    aria-label={`Go to page ${paginationPage}`}
                  >
                    {paginationPage}
                  </Button>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <Button
                variant="ghost"
                size="default"
                className="pr-1.5"
                disabled={!canGoNext}
                onClick={() => changePage(currentPage + 1)}
                aria-label="Go to next page"
              >
                <span className="hidden sm:block">Next</span>
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
