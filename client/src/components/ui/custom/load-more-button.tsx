import { Button } from '@/components/ui/button'

interface LoadMoreButtonProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  label?: string
}

export function LoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  label = 'Load more',
}: LoadMoreButtonProps) {
  if (!hasNextPage) return null

  return (
    <div className="flex justify-center border-t p-4">
      <Button
        type="button"
        variant="outline"
        disabled={isFetchingNextPage}
        onClick={onLoadMore}
      >
        {isFetchingNextPage ? 'Loading…' : label}
      </Button>
    </div>
  )
}
