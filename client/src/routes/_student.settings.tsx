import { createFileRoute } from '@tanstack/react-router'

import { StudentSettingsPage } from '@/features/student/pages/student-settings-page'

export const Route = createFileRoute('/_student/settings')({
  component: StudentSettingsPage,
  head: () => ({
    meta: [{ title: 'Settings — Morshid' }],
  }),
})
