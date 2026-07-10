import { createFileRoute, redirect } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'
import { getProtectedRoleRedirectPath } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/student')({
  ssr: false,
  beforeLoad: () => {
    const redirectPath = getProtectedRoleRedirectPath('student')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: () => <RolePlaceholderPage roleName="Student" />,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
