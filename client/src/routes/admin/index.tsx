import { createFileRoute } from '@tanstack/react-router'

import { RolePlaceholderPage } from '@/features/auth/components/role-placeholder-page'

export const Route = createFileRoute('/admin/')({
  component: () => <RolePlaceholderPage roleName="Admin" />,
})
