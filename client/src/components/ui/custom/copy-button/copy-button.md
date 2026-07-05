# CopyButton

Use `CopyButton` when users need to copy IDs, URLs, tokens, emails, or reference values.

Good places to use it:
- Course IDs, student IDs, invitation links, API endpoints, invoice references.
- Detail pages where a value is long or frequently copied.

Import:

```tsx
import { CopyButton } from '@/components/ui/custom/copy-button'
```

Basic usage:

```tsx
<CopyButton value={course.id} variant="outline" size="sm">
  Copy ID
</CopyButton>
```

Custom copied label:

```tsx
<CopyButton value={inviteUrl} copiedLabel="Link copied">
  Copy invite link
</CopyButton>
```

Notes:
- Uses `navigator.clipboard.writeText`.
- Shows a temporary copied state after success.
