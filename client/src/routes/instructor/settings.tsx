import { createFileRoute } from '@tanstack/react-router'

import { InstructorSettingsPage } from '@/features/instructor/pages/instructor-settings-page'

export const Route = createFileRoute('/instructor/settings')({
  component: InstructorSettingsPage,
})
