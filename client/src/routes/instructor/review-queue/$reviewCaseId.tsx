import {
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'

import { InstructorReviewDetailRoute } from '@/workspaces/instructor/reviews/review-detail-route'

export const Route = createFileRoute('/instructor/review-queue/$reviewCaseId')({
  component: ReviewDetailRoute,
})

function ReviewDetailRoute() {
  const { reviewCaseId } = Route.useParams()
  const router = useRouter()
  const isQueueOverlay = useRouterState({
    select: (state) => state.location.state.reviewQueueOverlay === true,
  })

  return (
    <InstructorReviewDetailRoute
      reviewCaseId={reviewCaseId}
      isQueueOverlay={isQueueOverlay}
      onClose={() => router.history.back()}
    />
  )
}
