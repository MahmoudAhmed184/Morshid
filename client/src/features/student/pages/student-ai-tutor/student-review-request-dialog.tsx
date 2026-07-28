import { CircleAlert, LoaderCircle, Send } from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { isApiError } from '@/lib/api/http'

interface StudentReviewRequestDialogProps {
  messageId: string
  onSubmit: (input: { messageId: string; note: string }) => Promise<unknown>
}

const NOTE_LIMIT = 200

export function StudentReviewRequestDialog({
  messageId,
  onSubmit,
}: StudentReviewRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const remaining = NOTE_LIMIT - note.length

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setNote('')
      setError(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (remaining < 0) return
    setIsPending(true)
    setError(null)
    try {
      await onSubmit({ messageId, note })
      setIsPending(false)
      handleOpenChange(false)
    } catch (submitError) {
      setError(submitError)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button type="button" size="sm" variant="outline" />}
      >
        <Send aria-hidden />
        Request review
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Request Instructor review</DialogTitle>
          <DialogDescription>
            Ask an Instructor to review this response. You may include a short
            note.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`review-note-${messageId}`}>Note (optional)</Label>
            <Textarea
              id={`review-note-${messageId}`}
              value={note}
              aria-describedby={`review-note-count-${messageId}`}
              aria-invalid={remaining < 0}
              disabled={isPending}
              maxLength={NOTE_LIMIT}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What would you like the Instructor to check?"
            />
            <p
              id={`review-note-count-${messageId}`}
              className="text-xs text-muted-foreground"
            >
              {remaining} characters remaining
            </p>
          </div>
          {error ? <ReviewRequestError error={error} /> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || remaining < 0}>
              {isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRequestError({ error }: { error: unknown }) {
  let message = 'The request could not be submitted. Please try again.'
  if (isApiError(error)) {
    if (error.code === 'MANUAL_REVIEW_QUOTA_EXCEEDED') {
      message = 'You have reached today’s review request limit.'
    } else if (error.status === 401 || error.status === 403) {
      message = 'Please sign in again before requesting a review.'
    } else if (error.status === 400 || error.status === 404) {
      message = 'This response is not available for review.'
    }
  }
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
