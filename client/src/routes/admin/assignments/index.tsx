import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { AdminAssignmentsPage } from '@/workspaces/admin/pages/admin-assignments-page'
import { loadAdminAssignmentsRoute } from '@/routes/-admin-loaders'

export const Route = createFileRoute('/admin/assignments/')({
  validateSearch: z.object({
    courseId: z.uuid().optional(),
    role: z.enum(['STUDENT', 'INSTRUCTOR']).optional(),
    search: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).optional(),
  }),
  loader: loadAdminAssignmentsRoute,
  component: AdminAssignmentsRoute,
})

function AdminAssignmentsRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <AdminAssignmentsPage
      urlState={search}
      onUrlStateChange={(next) =>
        void navigate({
          to: '/admin/assignments',
          search: (previous) => ({ ...previous, ...next }),
          replace: true,
        })
      }
    />
  )
}
