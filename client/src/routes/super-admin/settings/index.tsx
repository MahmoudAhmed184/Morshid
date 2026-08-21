import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/super-admin/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/super-admin/settings/account' })
  },
})
