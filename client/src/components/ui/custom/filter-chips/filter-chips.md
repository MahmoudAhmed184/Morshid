# FilterChips

Use `FilterChips` to display active filters and give users quick remove controls.

Good places to use it:
- Search/list pages with filters like status, role, date range, course, teacher.
- Below `DataToolbar` so active filters are visible.

Import:

```tsx
import { FilterChips } from '@/components/ui/custom/filter-chips'
```

Basic usage:

```tsx
<FilterChips
  filters={[
    { key: 'status', label: 'Active', onRemove: clearStatus },
    { key: 'role', label: 'Teacher', onRemove: clearRole },
  ]}
  onClearAll={clearFilters}
/>
```

Notes:
- Returns `null` when `filters` is empty.
- Use stable `key` values like `status`, `role`, or `date-range`.
