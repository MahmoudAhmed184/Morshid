import { createFileRoute, redirect } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'
import { getProtectedRoleRedirectPath } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/instructor')({
  beforeLoad: () => {
    const redirectPath = getProtectedRoleRedirectPath('instructor')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: () => <RolePlaceholderPage roleName="Instructor" />,
  head: () => ({
    meta: [{ title: 'Instructor — Morshid' }],
  }),
})
