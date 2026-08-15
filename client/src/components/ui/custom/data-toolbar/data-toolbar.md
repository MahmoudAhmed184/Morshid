# DataToolbar

Use `DataToolbar` above tables and lists to keep search, filters, actions, and bulk actions consistent.

Good places to use it:

- Course lists, student lists, admin tables, and invoice tables.
- Any page with search, filters, and a primary action button.

Import:

```tsx
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
```

Basic usage:

```tsx
<DataToolbar
  search={search}
  onSearchChange={setSearch}
  searchPlaceholder="Search courses..."
  actions={<Button>Create course</Button>}
/>
```

With filters and bulk actions:

```tsx
<DataToolbar
  search={search}
  onSearchChange={setSearch}
  filters={<StatusFilter value={status} onChange={setStatus} />}
  actions={<Button>Create student</Button>}
  selectedCount={selectedRows.length}
  bulkActions={<Button variant="destructive">Delete selected</Button>}
/>
```

Notes:

- `bulkActions` renders only when `selectedCount > 0`.
- `filters` accepts any React node, such as selects, tabs, chips, or custom controls.
