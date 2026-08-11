import { createFileRoute } from '@tanstack/react-router'

import { AdminMaterialsPage } from '@/workspaces/admin/pages/admin-materials-page'
import { loadAdminMaterialsRoute } from '@/workspaces/admin/routing/admin-route-loader'

export const Route = createFileRoute('/admin/materials/')({
  loader: loadAdminMaterialsRoute,
  component: AdminMaterialsPage,
})
