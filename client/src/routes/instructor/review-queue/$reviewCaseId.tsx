import { createFileRoute } from '@tanstack/react-router'

import { ReviewDetailPage } from '@/features/instructor/pages/review-detail-page'

export const Route = createFileRoute('/instructor/review-queue/$reviewCaseId')({
  component: ReviewDetailRoute,
})

function ReviewDetailRoute() {
  const { reviewCaseId } = Route.useParams()
  return <ReviewDetailPage reviewCaseId={reviewCaseId} />
}
