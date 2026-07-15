import { createFileRoute } from '@tanstack/react-router'

import { StudentSettingsPage } from '@/features/student/pages/student-settings-page'

export const Route = createFileRoute('/student/settings')({
  component: StudentSettingsPage,
})
