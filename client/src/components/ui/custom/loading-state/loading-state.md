# LoadingState

Use `LoadingState` to show skeleton screens while data is loading.

## When to use

- Query-backed cards, tables, and lists.
- Pages where a spinner causes layout shift.

## Import

```tsx
import { LoadingState } from '@/components/ui/custom/loading-state'
```

## Examples

### Card skeleton

```tsx
<LoadingState variant="cards" rows={3} />
```

### Table skeleton

```tsx
<LoadingState variant="table" rows={8} />
```

### List skeleton

```tsx
<LoadingState variant="list" rows={5} />
```

## Notes

- Prefer using `LoadingState` inside `DataTableState` for table and list pages.
- Use `rows` to approximate expected content height.
