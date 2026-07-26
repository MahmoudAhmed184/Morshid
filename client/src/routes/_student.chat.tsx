import { createFileRoute } from '@tanstack/react-router'

import { StudentAiTutorPage } from '@/features/student/pages/student-ai-tutor/student-ai-tutor-page'
import { studentAiTutorSearchSchema } from '@/features/student/schemas/student-chat.schema'

export const Route = createFileRoute('/_student/chat')({
  validateSearch: studentAiTutorSearchSchema,
  component: StudentChatRoute,
  head: () => ({
    meta: [{ title: 'Chat — Morshid' }],
  }),
})

function StudentChatRoute() {
  // `courseId` stays in the URL contract (links and the switcher navigate with
  // it) but is read through the shell's shared course state, not passed down.
  const { sessionId } = Route.useSearch()

  return <StudentAiTutorPage sessionId={sessionId} />
}
