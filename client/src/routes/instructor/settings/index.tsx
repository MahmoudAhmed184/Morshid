import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/instructor/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/instructor/settings/account' })
  },
})
