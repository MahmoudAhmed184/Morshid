# StatusBadge

Use `StatusBadge` to display lifecycle or health status.

Where to use it:

- Course status, student status, API readiness, payment status, moderation state.
- Tables and detail pages that need consistent status styling.

Import:

```tsx
import { StatusBadge } from '@/components/ui/custom/status-badge'
```

Basic usage:

```tsx
<StatusBadge status={course.status} />
```

Custom label:

```tsx
<StatusBadge status="offline" label="API offline" />
```

Override tone:

```tsx
<StatusBadge status="custom" tone="secondary" label="Queued" />
```

Notes:

- Unknown statuses fall back to `outline`.
- Built-in mappings include `ready`, `offline`, `degraded`, `active`, `pending`, and `failed`.
