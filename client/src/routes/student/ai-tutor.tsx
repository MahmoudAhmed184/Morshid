import { createFileRoute, redirect } from '@tanstack/react-router'

import { studentAiTutorSearchSchema } from '@/features/student/schemas/student-chat.schema'

export const Route = createFileRoute('/student/ai-tutor')({
  validateSearch: studentAiTutorSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/chat', search })
  },
})
