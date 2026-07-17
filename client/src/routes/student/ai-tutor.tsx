import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { StudentAiTutorPage } from '@/features/student/pages/student-ai-tutor/student-ai-tutor-page'

export const Route = createFileRoute('/student/ai-tutor')({
  validateSearch: z.object({
    courseId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
  }),
  component: StudentAiTutorRoute,
  head: () => ({
    meta: [{ title: 'AI Tutor — Morshid' }],
  }),
})

function StudentAiTutorRoute() {
  const { courseId, sessionId } = Route.useSearch()

  return <StudentAiTutorPage courseId={courseId} sessionId={sessionId} />
}
