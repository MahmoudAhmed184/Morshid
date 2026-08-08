import { CircleAlert, Flag, LoaderCircle } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { StudentFlagReason } from '@/features/student/schemas/student-chat.schema'
import { isApiError } from '@/lib/api/http'

interface StudentReviewRequestDialogProps {
  messageId: string
  onSubmit: (input: {
    messageId: string
    flagReason: StudentFlagReason
    note: string
  }) => Promise<unknown>
}

const NOTE_LIMIT = 200
const FLAG_REASON_OPTIONS: ReadonlyArray<{
  value: StudentFlagReason
  label: string
}> = [
  { value: 'INCORRECT', label: 'Seems incorrect' },
  { value: 'CONFUSING', label: 'Confusing or unclear' },
  { value: 'UNHELPFUL', label: 'Not helpful' },
  { value: 'COURSE_MISMATCH', label: 'Doesn’t match course material' },
  { value: 'TOO_MUCH_ANSWER', label: 'Gave away too much' },
  { value: 'OTHER', label: 'Other' },
]

export function StudentReviewRequestDialog({
  messageId,
  onSubmit,
}: StudentReviewRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [flagReason, setFlagReason] = useState<StudentFlagReason | null>(null)
  const [note, setNote] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const remaining = NOTE_LIMIT - note.length
  const requiresOtherNote = flagReason === 'OTHER' && note.trim().length === 0
  const showOtherNoteError = showValidation && requiresOtherNote
  const reasonLegendId = `review-reason-legend-${messageId}`
  const noteCountId = `review-note-count-${messageId}`
  const noteErrorId = `review-note-error-${messageId}`

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setFlagReason(null)
      setNote('')
      setShowValidation(false)
      setError(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setShowValidation(true)
    if (flagReason === null || requiresOtherNote || remaining < 0) return
    setIsPending(true)
    setError(null)
    try {
      await onSubmit({ messageId, flagReason, note: note.trim() })
      setIsPending(false)
      handleOpenChange(false)
    } catch (submitError) {
      setError(submitError)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Request review"
        onClick={() => setOpen(true)}
      >
        <Flag aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>Request Instructor review</DialogTitle>
            <DialogDescription>
              Ask an Instructor to review this response. You may include a short
              note.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" noValidate onSubmit={handleSubmit}>
            <fieldset className="space-y-2" disabled={isPending}>
              <legend id={reasonLegendId} className="text-sm font-medium">
                Reason
              </legend>
              <div
                className="grid gap-2"
                role="radiogroup"
                aria-labelledby={reasonLegendId}
              >
                {FLAG_REASON_OPTIONS.map((option) => {
                  const id = `review-reason-${messageId}-${option.value}`
                  return (
                    <Label
                      key={option.value}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 font-normal has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <input
                        id={id}
                        type="radio"
                        name={`review-reason-${messageId}`}
                        value={option.value}
                        checked={flagReason === option.value}
                        className="size-4 accent-primary"
                        onChange={() => {
                          setFlagReason(option.value)
                          setShowValidation(false)
                        }}
                      />
                      {option.label}
                    </Label>
                  )
                })}
              </div>
              {showValidation && flagReason === null ? (
                <p className="text-sm text-destructive" role="alert">
                  Choose a reason for requesting review.
                </p>
              ) : null}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor={`review-note-${messageId}`}>
                Note {flagReason === 'OTHER' ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                id={`review-note-${messageId}`}
                value={note}
                aria-describedby={
                  showOtherNoteError
                    ? `${noteCountId} ${noteErrorId}`
                    : noteCountId
                }
                aria-invalid={remaining < 0 || showOtherNoteError}
                disabled={isPending}
                maxLength={NOTE_LIMIT}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What would you like the Instructor to check?"
              />
              <p id={noteCountId} className="text-xs text-muted-foreground">
                {remaining} characters remaining
              </p>
              {showOtherNoteError ? (
                <p
                  id={noteErrorId}
                  className="text-sm text-destructive"
                  role="alert"
                >
                  Add a note when selecting Other.
                </p>
              ) : null}
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
    </>
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
