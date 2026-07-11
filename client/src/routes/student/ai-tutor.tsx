import { createFileRoute } from '@tanstack/react-router'

import { StudentAiTutorPage } from '@/features/student/student-ai-tutor-page'

export const Route = createFileRoute('/student/ai-tutor')({
  component: StudentAiTutorPage,
  head: () => ({
    meta: [{ title: 'AI Tutor — Morshid' }],
  }),
})
