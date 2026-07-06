# DataTableState

Use `DataTableState` to centralize loading, error, empty, and content rendering for tables and lists.

Good places to use it:
- Query-backed pages using TanStack Query.
- Any table page that currently has repeated `isPending`, `isError`, and empty checks.

Import:

```tsx
import { DataTableState } from '@/components/ui/custom/data-table-state'
```

Basic usage:

```tsx
<DataTableState
  isLoading={query.isPending}
  isError={query.isError}
  isEmpty={students.length === 0}
  onRetry={() => query.refetch()}
  isRetrying={query.isFetching}
  emptyTitle="No students found"
>
  <StudentsTable students={students} />
</DataTableState>
```

Custom states:

```tsx
<DataTableState
  isLoading={query.isPending}
  isError={query.isError}
  isEmpty={courses.length === 0}
  loading={<LoadingState variant="cards" />}
  empty={<EmptyState title="No courses yet" action={<Button>Create</Button>} />}
>
  <CoursesGrid courses={courses} />
</DataTableState>
```

Notes:
- State priority is loading, then error, then empty, then children.
- Use this for table/list pages, not for tiny inline widgets.
