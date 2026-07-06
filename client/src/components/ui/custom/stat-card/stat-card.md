# StatCard

Use `StatCard` for dashboard metrics and compact page summaries.

Good places to use it:
- Active students, published courses, total revenue, pending requests.
- Top-row summary cards on admin or teacher dashboards.

Import:

```tsx
import { StatCard } from '@/components/ui/custom/stat-card'
```

Basic usage:

```tsx
<StatCard
  label="Active students"
  value={128}
  trend="+12%"
  icon={<UsersIcon />}
/>
```

With description:

```tsx
<StatCard
  label="Readiness"
  value="Ready"
  description="All runtime dependencies are online."
/>
```

Notes:
- Keep values short so cards remain scannable.
- Use `trend` for deltas, percentages, or status hints.
