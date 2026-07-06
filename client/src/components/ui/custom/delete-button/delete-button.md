# DeleteButton

Use `DeleteButton` when the common delete flow should include a destructive button and confirmation dialog.

Good places to use it:
- Delete course, lesson, user, student, file, or payment method.
- Simple delete flows where a full custom dialog is unnecessary.

Import:

```tsx
import { DeleteButton } from '@/components/ui/custom/delete-button'
```

Basic usage:

```tsx
<DeleteButton
  title="Delete course?"
  description="This action cannot be undone."
  onDelete={deleteCourse}
/>
```

With typed confirmation:

```tsx
<DeleteButton
  title="Delete workspace?"
  description="Type DELETE to confirm."
  confirmValue="DELETE"
  onDelete={deleteWorkspace}
/>
```

Notes:
- Uses `ConfirmDialog` internally.
- Use `ConfirmDialog` directly when the action is not delete or needs custom labels.
