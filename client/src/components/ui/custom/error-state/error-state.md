# ErrorState

Use `ErrorState` when data fails to load and the user can retry or recover.

When to use:

- Query failures in tables, detail pages, dashboards, and cards.
- API readiness or dependency failures.

Import:

```tsx
import { ErrorState } from '@/components/ui/custom/error-state'
```

Basic usage:

```tsx
<ErrorState
  description="Courses could not be loaded."
  onRetry={() => refetch()}
  isRetrying={isFetching}
/>
```

Custom action:

```tsx
<ErrorState
  title="Payment failed"
  description="The latest payment status could not be loaded."
  action={<Button variant="outline">Contact support</Button>}
/>
```

Notes:

- Pass `onRetry` when the user can retry the request.
- `isRetrying` shows a spinner on the retry icon.
