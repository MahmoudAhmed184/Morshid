import { createFileRoute, redirect } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'
import { requireRole } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/instructor')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('INSTRUCTOR')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: () => <RolePlaceholderPage roleName="Instructor" />,
  head: () => ({
    meta: [{ title: 'Instructor — Morshid' }],
  }),
})
