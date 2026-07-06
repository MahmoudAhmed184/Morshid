# DetailField

Use `DetailField` for read-only label/value rows in detail pages.

Good places to use it:
- Student profile details, course metadata, billing details, API configuration.
- Any read-only page with repeated label/value layout.

Import:

```tsx
import { DetailField } from '@/components/ui/custom/detail-field'
```

Basic usage:

```tsx
<dl>
  <DetailField label="Email" value={student.email} />
  <DetailField label="Role" value={student.role} />
</dl>
```

With action:

```tsx
<DetailField
  label="Course ID"
  value={course.id}
  action={<CopyButton value={course.id} size="sm" variant="outline" />}
/>
```

Notes:
- Empty values render `-` by default.
- Override with `emptyValue` when needed.
