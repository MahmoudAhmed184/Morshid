import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { InstructorLayout } from '@/features/instructor/components/instructor-layout'
import { requireRole } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/instructor')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('INSTRUCTOR')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: InstructorLayout,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Instructor — Morshid' }],
  }),
})
