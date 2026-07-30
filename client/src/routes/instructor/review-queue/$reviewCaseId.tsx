import {
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ReviewDetailPage } from '@/features/instructor/pages/review-detail-page'
import { ReviewQueuePage } from '@/features/instructor/pages/review-queue-page'

export const Route = createFileRoute('/instructor/review-queue/$reviewCaseId')({
  component: ReviewDetailRoute,
})

function ReviewDetailRoute() {
  const { reviewCaseId } = Route.useParams()
  const router = useRouter()
  const isQueueOverlay = useRouterState({
    select: (state) => state.location.state.reviewQueueOverlay === true,
  })

  if (!isQueueOverlay) {
    return <ReviewDetailPage reviewCaseId={reviewCaseId} />
  }

  const closeDialog = () => router.history.back()

  return (
    <>
      <ReviewQueuePage />
      <Dialog open onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-5xl sm:p-7">
          <DialogTitle className="sr-only">
            Instructor review detail
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the flagged exchange, supporting evidence, and nearby
            conversation context.
          </DialogDescription>
          <ReviewDetailPage reviewCaseId={reviewCaseId} presentation="dialog" />
        </DialogContent>
      </Dialog>
    </>
  )
}
