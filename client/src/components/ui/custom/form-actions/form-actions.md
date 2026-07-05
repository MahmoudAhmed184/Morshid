# FormActions

Use `FormActions` at the bottom of forms for consistent Cancel and Save actions.

Good places to use it:
- Create/edit course, student, profile, pricing, and settings forms.
- Forms that need a consistent submit loading state.

Import:

```tsx
import { FormActions } from '@/components/ui/custom/form-actions'
```

Basic usage:

```tsx
<FormActions
  onSubmit={handleSubmit}
  onCancel={() => navigateBack()}
  isSubmitting={mutation.isPending}
/>
```

Custom labels and extra content:

```tsx
<FormActions
  submitLabel="Publish"
  cancelLabel="Discard"
  onSubmit={publishCourse}
  onCancel={discardChanges}
  extra={<DeleteButton title="Delete course?" onDelete={deleteCourse} />}
/>
```

Notes:
- Uses `AsyncButton` for submit.
- `extra` renders on the left side on desktop.
