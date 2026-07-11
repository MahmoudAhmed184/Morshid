import { createFileRoute } from '@tanstack/react-router'

import { MaterialsPage } from '@/features/instructor/materials-page'

export const Route = createFileRoute('/instructor/materials/')({
  component: MaterialsPage,
})
