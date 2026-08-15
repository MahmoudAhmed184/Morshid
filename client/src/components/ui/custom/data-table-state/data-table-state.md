# DataTableState

Use `DataTableState` to centralize loading, error, empty, and content rendering for tables and lists.

## When to use

- Query-backed pages using TanStack Query.
- Table pages with repeated `isPending`, `isError`, and empty checks.

## Import

```tsx
import { DataTableState } from '@/components/ui/custom/data-table-state'
```

## Basic usage

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

## Custom states

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

## Notes

- State priority is loading, then error, then empty, then children.
- Use this component for table and list pages, not small inline widgets.
