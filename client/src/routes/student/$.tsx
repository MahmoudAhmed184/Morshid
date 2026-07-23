import { createFileRoute, redirect } from '@tanstack/react-router'

// Legacy `/student/*` deep links. `/student/ai-tutor` is handled by its own
// (more specific) route; everything else lands on the courses home, except the
// settings page which keeps its dedicated destination.
export const Route = createFileRoute('/student/$')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: params._splat === 'settings' ? '/settings' : '/courses',
    })
  },
})
