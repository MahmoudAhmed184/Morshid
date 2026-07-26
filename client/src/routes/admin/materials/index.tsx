import { createFileRoute } from '@tanstack/react-router'

import { AdminMaterialsPage } from '@/features/admin/pages/admin-materials-page'
import { loadAdminMaterialsRoute } from '@/features/admin/utils/admin-route-loader'

export const Route = createFileRoute('/admin/materials/')({
  loader: loadAdminMaterialsRoute,
  component: AdminMaterialsPage,
})
