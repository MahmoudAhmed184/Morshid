import { createFileRoute } from '@tanstack/react-router'

import { loadAdminDoctorsRoute } from '@/routes/-admin-loaders'
import { DoctorsPage } from '@/workspaces/admin/users/users-page'

export const Route = createFileRoute('/admin/users/doctors')({
  loader: loadAdminDoctorsRoute,
  component: DoctorsPage,
})
