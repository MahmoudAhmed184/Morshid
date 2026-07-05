# ConfirmDialog

Use `ConfirmDialog` for dangerous or important actions that need explicit confirmation.

Good places to use it:
- Delete course, student, lesson, user, subscription, or payment records.
- Archive, reset, revoke, disable, or publish actions.
- High-risk actions that need the user to type a confirmation word.

Import:

```tsx
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
```

Basic usage:

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Delete</Button>}
  title="Delete course?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  onConfirm={deleteCourse}
/>
```

Require typed confirmation:

```tsx
<ConfirmDialog
  trigger={<Button variant="destructive">Delete workspace</Button>}
  title="Delete workspace?"
  description="Type DELETE to permanently delete this workspace."
  confirmLabel="Delete"
  confirmInput={{ value: 'DELETE' }}
  onConfirm={deleteWorkspace}
/>
```

Controlled open state:

```tsx
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Publish course?"
  description="Students will be able to access this course."
  destructive={false}
  confirmLabel="Publish"
  onConfirm={publishCourse}
/>
```

Notes:
- `confirmInput.value` must match exactly after trimming the input.
- The dialog handles async `onConfirm` and closes after success.
