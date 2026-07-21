import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'

import { StudentSessionNavigationSkeleton } from './student-session-navigation-skeleton'

interface StudentSessionInfiniteScrollProps {
  hasNextPage: boolean
  isFetching: boolean
  isError: boolean
  onLoadMore: () => void
}

export function StudentSessionInfiniteScroll({
  hasNextPage,
  isFetching,
  isError,
  onLoadMore,
}: StudentSessionInfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (
      !sentinel ||
      !hasNextPage ||
      isFetching ||
      isError ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '0px 0px 160px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isError, isFetching, onLoadMore])

  if (isError) {
    return (
      <div
        role="alert"
        className="mt-3 rounded-xl border border-destructive/30 px-3 py-2 text-center"
      >
        <p className="text-xs text-destructive">
          More conversations could not be loaded.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onLoadMore}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div ref={sentinelRef} className="mt-1 min-h-px">
      {isFetching ? (
        <StudentSessionNavigationSkeleton label="Loading more conversations" />
      ) : null}
    </div>
  )
}
