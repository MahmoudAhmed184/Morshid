import { createFileRoute } from '@tanstack/react-router'

import { StudentSettingsLayout } from '@/workspaces/student/settings/student-settings-layout'

export const Route = createFileRoute('/_student/settings')({
  component: StudentSettingsLayout,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
