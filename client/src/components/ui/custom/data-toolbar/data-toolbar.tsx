import { SearchInput } from '@/components/ui/custom/search-input'
import { cn } from '@/lib/utils'

type DataToolbarProps = {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: React.ReactNode
  actions?: React.ReactNode
  bulkActions?: React.ReactNode
  selectedCount?: number
  className?: string
  contentClassName?: string
  controlsClassName?: string
  searchClassName?: string
  actionsClassName?: string
}

/*
Usage:
<DataToolbar
  search={search}
  onSearchChange={setSearch}
  filters={<StatusFilter value={status} onChange={setStatus} />}
  actions={<Button>Create</Button>}
  selectedCount={selectedRows.length}
  bulkActions={<Button variant="destructive">Delete selected</Button>}
/>
*/
export function DataToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  actions,
  bulkActions,
  selectedCount = 0,
  className,
  contentClassName,
  controlsClassName,
  searchClassName,
  actionsClassName,
}: DataToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className={cn(
          'flex flex-col items-stretch gap-2.5 lg:flex-row lg:items-center lg:justify-between',
          contentClassName,
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center min-w-0 flex-1',
            controlsClassName,
          )}
        >
          {onSearchChange ? (
            <SearchInput
              value={search ?? ''}
              onValueChange={onSearchChange}
              placeholder={searchPlaceholder}
              className={cn('w-full sm:w-64 xl:w-72 shrink-0', searchClassName)}
            />
          ) : null}
          {filters}
        </div>
        {actions ? (
          <div
            className={cn(
              'flex w-full shrink-0 items-center justify-end gap-2 [&>*]:w-full sm:w-auto sm:[&>*]:w-auto',
              actionsClassName,
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {selectedCount > 0 && bulkActions ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            {selectedCount} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions}</div>
        </div>
      ) : null}
    </div>
  )
}
