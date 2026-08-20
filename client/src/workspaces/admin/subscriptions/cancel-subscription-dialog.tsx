import { Calendar, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCancelMySubscriptionMutation } from '@/features/subscriptions/interface'
import type { UniversitySubscriptionItem } from '@/features/subscriptions/interface'

type CancelSubscriptionDialogProps = {
  subscription: UniversitySubscriptionItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(isoString?: string) {
  if (!isoString) return 'the start of next month'
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export function CancelSubscriptionDialog({
  subscription,
  open,
  onOpenChange,
}: CancelSubscriptionDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const cancelMutation = useCancelMySubscriptionMutation()

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setErrorMessage(null)
    }
  }

  if (!subscription) {
    return null
  }

  const nextBillingFormatted = formatDate(subscription.nextBillingDate)

  const handleConfirm = async () => {
    setErrorMessage(null)
    try {
      await cancelMutation.mutateAsync()
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to schedule subscription cancellation.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" aria-hidden />
          </div>
          <DialogTitle>Cancel Subscription?</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your university subscription for{' '}
            <strong className="font-semibold text-foreground">
              {subscription.universityName}
            </strong>
            ?
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2.5 text-sm text-foreground">
            <Calendar className="size-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold">
                Cancellation takes effect at period end
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your subscription remains fully active until the end of the
                current billing period on{' '}
                <strong className="font-semibold text-foreground">
                  {nextBillingFormatted}
                </strong>
                . When the cycle ends, your subscription will be cancelled and
                the university marked Inactive.
              </p>
            </div>
          </div>
          <div className="border-t border-destructive/10 pt-2 text-xs text-muted-foreground">
            You will receive a final invoice for this cycle based on your peak
            student count ({subscription.peakStudentsCount} seats &times; $
            {subscription.effectivePricePerSeat.toFixed(2)} = $
            {subscription.estimatedMonthlyTotal.toFixed(2)}).
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={cancelMutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Keep Subscription
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={cancelMutation.isPending}
            onClick={() => void handleConfirm()}
          >
            {cancelMutation.isPending
              ? 'Cancelling...'
              : 'Confirm Cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
