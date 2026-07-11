import { createFileRoute } from '@tanstack/react-router'

import { AdminMaterialsPage } from '@/features/admin/pages/admin-materials-page'

export const Route = createFileRoute('/admin/materials/')({
  component: AdminMaterialsPage,
})
