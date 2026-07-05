# EmptyState

Use `EmptyState` when a page, table, or section has no data to display.

Good places to use it:
- No courses, no students, no search results, no invoices, no messages.
- First-use screens that need a primary action.

Import:

```tsx
import { EmptyState } from '@/components/ui/custom/empty-state'
```

Basic usage:

```tsx
<EmptyState
  title="No courses yet"
  description="Create your first course to start adding lessons."
  action={<Button>Create course</Button>}
/>
```

Search empty state:

```tsx
<EmptyState
  title="No results found"
  description="Try changing your search or filters."
  secondaryAction={<Button variant="outline">Clear filters</Button>}
/>
```

Notes:
- Use `action` for the primary next step.
- Use `secondaryAction` for reset or navigation actions.
