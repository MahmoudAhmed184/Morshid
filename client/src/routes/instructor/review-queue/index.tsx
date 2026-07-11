import { createFileRoute } from '@tanstack/react-router'

import { ReviewQueuePage } from '@/features/instructor/review-queue-page'

export const Route = createFileRoute('/instructor/review-queue/')({
  component: ReviewQueuePage,
})
