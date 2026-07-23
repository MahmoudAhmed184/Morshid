import { createFileRoute, redirect } from '@tanstack/react-router'

// T12.2 — course = notebook, not a page. The library home retires; `/courses`
// now redirects into the chat workspace, which resolves the active course via
// the existing selection logic.
export const Route = createFileRoute('/_student/courses')({
  beforeLoad: () => {
    throw redirect({ to: '/chat' })
  },
})
