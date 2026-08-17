# SearchInput

Use `SearchInput` for controlled search fields with an icon and clear button.

## When to use

- Table and list search.
- Search inside pickers, settings, users, courses, invoices, and messages.

## Import

```tsx
import { SearchInput } from '@/components/ui/custom/search-input'
```

## Basic usage

```tsx
<SearchInput
  value={search}
  onValueChange={setSearch}
  placeholder="Search students..."
/>
```

## With clear callback

```tsx
<SearchInput
  value={search}
  onValueChange={setSearch}
  onClear={() => setPage(1)}
/>
```

## Notes

- This component is controlled.
- Debounce search in the parent when API calls are expensive.
