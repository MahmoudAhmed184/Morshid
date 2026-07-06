import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { LoadingState } from '#/components/ui/custom/loading-state'

type DataTableStateProps = {
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  children: React.ReactNode
  loading?: React.ReactNode
  error?: React.ReactNode
  empty?: React.ReactNode
  onRetry?: () => void
  isRetrying?: boolean
  emptyTitle?: React.ReactNode
  emptyDescription?: React.ReactNode
  errorTitle?: React.ReactNode
  errorDescription?: React.ReactNode
}

/*
Usage:
<DataTableState
  isLoading={query.isPending}
  isError={query.isError}
  isEmpty={data.length === 0}
  onRetry={() => query.refetch()}
  emptyTitle="No students found"
>
  <StudentsTable data={data} />
</DataTableState>
*/
export function DataTableState({
  isLoading = false,
  isError = false,
  isEmpty = false,
  children,
  loading,
  error,
  empty,
  onRetry,
  isRetrying,
  emptyTitle = 'No results found',
  emptyDescription = 'Try changing your search or filters.',
  errorTitle,
  errorDescription,
}: DataTableStateProps) {
  if (isLoading) {
    return loading ?? <LoadingState variant="table" />
  }

  if (isError) {
    return (
      error ?? (
        <ErrorState
          title={errorTitle}
          description={errorDescription}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      )
    )
  }

  if (isEmpty) {
    return (
      empty ?? <EmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return children
}
