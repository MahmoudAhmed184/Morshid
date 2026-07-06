# AsyncButton

Use `AsyncButton` when a button starts an async action and needs a consistent pending state.

Good places to use it:
- Save, publish, resend, sync, import, export, or submit actions.
- Any action where the button should be disabled while the promise is running.
- Mutations that should show loading text without repeating local `isLoading` state.

Import:

```tsx
import { AsyncButton } from '@/components/ui/custom/async-button'
```

Basic usage:

```tsx
<AsyncButton onClick={saveCourse} loadingText="Saving...">
  Save
</AsyncButton>
```

Controlled loading:

```tsx
<AsyncButton
  onClick={publishCourse}
  isLoading={publishMutation.isPending}
  loadingText="Publishing..."
>
  Publish
</AsyncButton>
```

Notes:
- `onClick` can return `void` or a `Promise`.
- If `isLoading` is passed, the parent controls loading state.
- Without `isLoading`, the component tracks loading internally.
