import { createFileRoute } from '@tanstack/react-router'
import { AdminAllowancePolicyPage } from '@/features/allowances/interface'

export const Route = createFileRoute('/admin/settings/usage')({
  component: () => <AdminAllowancePolicyPage scope="TUTORING" />,
  head: () => ({
    meta: [{ title: 'Usage Settings — Morshid' }],
  }),
})
