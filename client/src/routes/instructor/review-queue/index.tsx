import { createFileRoute } from '@tanstack/react-router'

import { ReviewQueuePage } from '@/features/instructor/pages/review-queue-page'

export const Route = createFileRoute('/instructor/review-queue/')({
  component: ReviewQueuePage,
})
