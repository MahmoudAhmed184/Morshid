# LoadingState

Use `LoadingState` for consistent skeleton screens while data is loading.

Good places to use it:
- Query-backed cards, tables, and lists.
- Pages where showing a spinner would cause layout shift.

Import:

```tsx
import { LoadingState } from '@/components/ui/custom/loading-state'
```

Card skeletons:

```tsx
<LoadingState variant="cards" rows={3} />
```

Table skeleton:

```tsx
<LoadingState variant="table" rows={8} />
```

List skeleton:

```tsx
<LoadingState variant="list" rows={5} />
```

Notes:
- Prefer this inside `DataTableState` for table/list pages.
- Use `rows` to approximate expected content height.
