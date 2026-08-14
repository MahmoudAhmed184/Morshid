import { createFileRoute } from '@tanstack/react-router'

import { ReviewQueuePage } from '@/workspaces/instructor/reviews/review-queue-page'

export const Route = createFileRoute('/instructor/review-queue/')({
  component: ReviewQueuePage,
})
