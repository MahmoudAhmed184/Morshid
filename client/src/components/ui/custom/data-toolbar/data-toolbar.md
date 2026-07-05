# DataToolbar

Use `DataToolbar` above tables and lists to keep search, filters, actions, and bulk actions consistent.

Good places to use it:
- Course lists, student lists, admin tables, invoice tables.
- Any page with search plus filters and a create/action button.

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
- `bulkActions` only appears when `selectedCount > 0`.
- `filters` can be any React node: selects, tabs, chips, or custom controls.
