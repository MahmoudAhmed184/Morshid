import { createFileRoute } from '@tanstack/react-router'

import { TutorPage } from '@/workspaces/student/tutor-workspace/tutor-page'
import { chatSearchSchema } from '@/features/chat/sessions/chat-session.schema'

export const Route = createFileRoute('/_student/chat')({
  validateSearch: chatSearchSchema,
  component: StudentChatRoute,
  head: () => ({
    meta: [{ title: 'Chat — Morshid' }],
  }),
})

function StudentChatRoute() {
  // `courseId` stays in the URL contract (links and the switcher navigate with
  // it) but is read through the shell's shared course state, not passed down.
  const { sessionId } = Route.useSearch()

  return <TutorPage sessionId={sessionId} />
}
