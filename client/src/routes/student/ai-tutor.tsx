import { createFileRoute } from '@tanstack/react-router'

import { StudentAiTutorPage } from '@/features/student/pages/student-ai-tutor/student-ai-tutor-page'
import { studentAiTutorSearchSchema } from '@/features/student/schemas/student-chat.schema'

export const Route = createFileRoute('/student/ai-tutor')({
  validateSearch: studentAiTutorSearchSchema,
  component: StudentAiTutorRoute,
  head: () => ({
    meta: [{ title: 'AI Tutor — Morshid' }],
  }),
})

function StudentAiTutorRoute() {
  const { courseId, sessionId } = Route.useSearch()

  return <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
}
