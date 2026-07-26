import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type SearchInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
}

/*
Usage:
<SearchInput
  value={search}
  onValueChange={setSearch}
  placeholder="Search courses..."
/>
*/
export function SearchInput({
  value,
  onValueChange,
  onClear,
  className,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const clearSearch = () => {
    onValueChange('')
    onClear?.()
  }

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        placeholder={placeholder}
        className="pr-8 pl-8"
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={clearSearch}
          aria-label="Clear search"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
