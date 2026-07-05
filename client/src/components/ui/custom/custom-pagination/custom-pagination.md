# CustomPagination

Use `CustomPagination` for any paginated list or table so pages do not repeat pagination logic.

Good places to use it:
- Courses, students, invoices, messages, audit logs, users, transactions.
- Any API response with `page`, `pageCount`, `totalItems`, and `pageSize`.

Import:

```tsx
import { CustomPagination } from '@/components/ui/custom/custom-pagination'
```

Basic usage:

```tsx
<CustomPagination
  page={page}
  pageCount={pageCount}
  onPageChange={setPage}
/>
```

With result summary:

```tsx
<CustomPagination
  page={page}
  pageCount={pageCount}
  totalItems={totalItems}
  pageSize={pageSize}
  showSummary
  onPageChange={setPage}
/>
```

With denser page controls:

```tsx
<CustomPagination
  page={page}
  pageCount={pageCount}
  siblingCount={2}
  boundaryCount={1}
  onPageChange={setPage}
/>
```

Notes:
- `page` is one-indexed. First page is `1`.
- Returns `null` when there is only one page and no summary.
- `disabled` prevents page changes while data is loading.
