# PageHeader

Use `PageHeader` for the main heading area of a page.

Good places to use it:
- Dashboard pages, index pages, detail pages, settings pages.
- Any page with title, description, badge/eyebrow, and right-side actions.

Import:

```tsx
import { PageHeader } from '@/components/ui/custom/page-header'
```

Basic usage:

```tsx
<PageHeader
  title="Courses"
  description="Manage course content, students, and publishing state."
  actions={<Button>Create course</Button>}
/>
```

With eyebrow:

```tsx
<PageHeader
  eyebrow={<Badge variant="secondary">Admin</Badge>}
  title="Student management"
  description="Review student enrollment and progress."
/>
```

Notes:
- Use once near the top of a page.
- Put page-level actions in `actions`, not inside the title block.
