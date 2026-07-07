import { createFileRoute } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'

export const Route = createFileRoute('/student')({
  component: () => <RolePlaceholderPage roleName="Student" />,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
