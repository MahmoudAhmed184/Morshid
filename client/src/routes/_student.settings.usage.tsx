import { createFileRoute } from '@tanstack/react-router'
import { StudentUsagePage } from '@/features/allowances/interface'

export const Route = createFileRoute('/_student/settings/usage')({
  component: () => <StudentUsagePage />,
  head: () => ({
    meta: [{ title: 'Usage & Reviews Settings — Morshid' }],
  }),
})
