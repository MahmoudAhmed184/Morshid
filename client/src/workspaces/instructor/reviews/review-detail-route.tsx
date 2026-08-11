import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

import { ReviewDetailPage } from './review-detail-page'
import { ReviewQueuePage } from './review-queue-page'

export function InstructorReviewDetailRoute({
  reviewCaseId,
  isQueueOverlay,
  onClose,
}: {
  reviewCaseId: string
  isQueueOverlay: boolean
  onClose: () => void
}) {
  if (!isQueueOverlay) {
    return <ReviewDetailPage reviewCaseId={reviewCaseId} />
  }

  return (
    <>
      <ReviewQueuePage />
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] sm:p-7 xl:max-w-7xl">
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
