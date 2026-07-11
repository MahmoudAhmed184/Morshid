import { createFileRoute, redirect } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'
import { getProtectedRoleRedirectPath } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/admin')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await getProtectedRoleRedirectPath('ADMIN')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: () => <RolePlaceholderPage roleName="Admin" />,
  head: () => ({
    meta: [{ title: 'Admin — Morshid' }],
  }),
})
