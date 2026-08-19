import { createFileRoute } from '@tanstack/react-router'

import { UniversitiesPage } from '@/workspaces/super-admin/universities/universities-page'

export const Route = createFileRoute('/super-admin/universities/')({
  component: UniversitiesPage,
})
