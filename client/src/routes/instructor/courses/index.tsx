import { createFileRoute, redirect } from '@tanstack/react-router'

// Compatibility for bookmarks from the retired instructor My Courses page.
// Course discovery now lives in the dashboard's course selector.
export const Route = createFileRoute('/instructor/courses/')({
  beforeLoad: () => {
    throw redirect({ to: '/instructor' })
  },
})
