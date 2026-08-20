import { createFileRoute } from '@tanstack/react-router'
import { AdminAiCapacityPage } from '@/features/ai-capacity/interface'

export const Route = createFileRoute('/admin/settings/ai-capacity')({
  component: () => <AdminAiCapacityPage />,
  head: () => ({
    meta: [{ title: 'AI Capacity Settings — Morshid' }],
  }),
})
