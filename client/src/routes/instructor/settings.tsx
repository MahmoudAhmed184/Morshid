import { createFileRoute } from '@tanstack/react-router'

import { InstructorSettingsLayout } from '@/workspaces/instructor/settings/instructor-settings-layout'

export const Route = createFileRoute('/instructor/settings')({
  component: InstructorSettingsLayout,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
