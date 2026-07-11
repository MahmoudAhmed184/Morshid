import { createFileRoute } from '@tanstack/react-router'

import { StudentShellPage } from '@/features/student/student-shell-page'

export const Route = createFileRoute('/student/')({
  component: StudentShellPage,
})
