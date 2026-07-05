import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type FilterChip = {
  key: string
  label: React.ReactNode
  onRemove: () => void
}

type FilterChipsProps = {
  filters: FilterChip[]
  onClearAll?: () => void
  className?: string
}

/*
Usage:
<FilterChips
  filters={[
    { key: 'status', label: 'Active', onRemove: clearStatus },
  ]}
  onClearAll={clearFilters}
/>
*/
export function FilterChips({
  filters,
  onClearAll,
  className,
}: FilterChipsProps) {
  if (filters.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((filter) => (
        <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
          {filter.label}
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-foreground/10"
            onClick={filter.onRemove}
            aria-label="Remove filter"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      {onClearAll ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  )
}
