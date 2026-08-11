import { createFileRoute } from '@tanstack/react-router'

import { MaterialsPage } from '@/workspaces/instructor/materials/materials-page'

export const Route = createFileRoute('/instructor/materials/')({
  component: MaterialsPage,
})
