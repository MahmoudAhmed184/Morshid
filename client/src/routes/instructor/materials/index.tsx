import { createFileRoute } from '@tanstack/react-router'

import { MaterialsPage } from '@/features/instructor/pages/materials-page'

export const Route = createFileRoute('/instructor/materials/')({
  component: MaterialsPage,
})
