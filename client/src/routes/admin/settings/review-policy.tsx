import { createFileRoute } from '@tanstack/react-router'
import { AdminAllowancePolicyPage } from '@/features/allowances/interface'

export const Route = createFileRoute('/admin/settings/review-policy')({
  component: () => <AdminAllowancePolicyPage scope="REVIEW" />,
  head: () => ({
    meta: [{ title: 'Review Policy Settings — Morshid' }],
  }),
})
