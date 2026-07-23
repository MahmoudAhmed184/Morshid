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
  const { courseId, sessionId } = Route.useSearch()

  return <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
}
