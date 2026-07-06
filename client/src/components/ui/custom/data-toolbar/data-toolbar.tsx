import { SearchInput } from '#/components/ui/custom/search-input'
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
}: DataToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {onSearchChange ? (
            <SearchInput
              value={search ?? ''}
              onValueChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          ) : null}
          {filters}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
