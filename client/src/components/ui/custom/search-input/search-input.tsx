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
    <div
      className={cn(
        'relative flex items-center w-full sm:max-w-xs self-start',
        className,
      )}
    >
      <SearchIcon className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground z-10" />
      <Input
        value={value}
        placeholder={placeholder}
        className="pr-8 pl-8 h-9 text-xs"
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 text-muted-foreground hover:text-foreground"
          onClick={clearSearch}
          aria-label="Clear search"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}
