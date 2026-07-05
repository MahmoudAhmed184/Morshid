# StatusBadge

Use `StatusBadge` when displaying known lifecycle or health statuses.

Good places to use it:
- Course status, student status, API readiness, payment status, moderation state.
- Tables and detail pages where status styling should be consistent.

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
- Current built-in mappings include `ready`, `offline`, `degraded`, `active`, `pending`, `failed`, and similar common statuses.
