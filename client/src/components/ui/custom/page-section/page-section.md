# PageSection

Use `PageSection` to structure a page into titled content sections.

Good places to use it:
- Detail pages with sections like Overview, Students, Lessons, Billing.
- Settings pages with grouped forms.

Import:

```tsx
import { PageSection } from '@/components/ui/custom/page-section'
```

Basic usage:

```tsx
<PageSection
  title="Students"
  description="Students enrolled in this course."
  actions={<Button>Add student</Button>}
>
  <StudentsTable />
</PageSection>
```

Without heading:

```tsx
<PageSection>
  <CourseSummary />
</PageSection>
```

Notes:
- Use `contentClassName` to style only the content wrapper.
- Use `className` to style the whole section.
