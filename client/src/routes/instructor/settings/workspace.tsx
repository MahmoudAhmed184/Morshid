import { createFileRoute } from '@tanstack/react-router'

import { InstructorWorkspaceSettingsPage } from '@/workspaces/instructor/settings/instructor-workspace-settings-page'

export const Route = createFileRoute('/instructor/settings/workspace')({
  component: InstructorWorkspaceSettingsPage,
  head: () => ({
    meta: [{ title: 'Workspace Settings — Morshid' }],
  }),
})
