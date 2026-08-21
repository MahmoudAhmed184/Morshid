import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useRejectInstructorReview,
  useResolveInstructorReview,
} from '@/workspaces/instructor/reviews/use-reviews'
import { isApiError } from '@/lib/http/http'

type EditorMode = 'EDITED' | 'REJECT'
type ReviewDrafts = Record<EditorMode, string>
type PendingConfirmation =
  { mode: 'APPROVED'; content: string } | { mode: EditorMode; content: string }

const draftStorageVersion = 2

export function ReviewActionPanel({
  reviewCaseId,
  version,
  canReject,
  originalContent,
  editPortalId,
}: {
  reviewCaseId: string
  version: number
  canReject: boolean
  originalContent: string
  editPortalId: string
}) {
  const resolveMutation = useResolveInstructorReview()
  const rejectMutation = useRejectInstructorReview()
  const submissionInFlight = useRef(false)
  const idempotencyRef = useRef<{
    fingerprint: string
    key: string
  } | null>(null)
  const [mode, setMode] = useState<EditorMode | null>(null)
  const draftStorageKey = `morshid:review-draft:${reviewCaseId}`
  const [drafts, setDrafts] = useState<ReviewDrafts>(
    () =>
      readStoredDraft(draftStorageKey, version) ?? {
        EDITED: originalContent,
        REJECT: '',
      },
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null)
  const isPending = resolveMutation.isPending || rejectMutation.isPending
  const actionsAreLocked = isPending || pendingConfirmation !== null
  const editPortalTarget =
    mode === 'EDITED' && typeof document !== 'undefined'
      ? document.getElementById(editPortalId)
      : null

  function approveOriginal() {
    if (isPending || submissionInFlight.current) return
    setMode(null)
    setValidationError(null)
    setPendingConfirmation({ mode: 'APPROVED', content: originalContent })
  }

  function rejectRequest() {
    if (isPending || submissionInFlight.current) return
    setMode(null)
    setValidationError(null)
    setPendingConfirmation({ mode: 'REJECT', content: drafts.REJECT })
  }

  async function submitEditor() {
    if (mode !== 'EDITED' || isPending || submissionInFlight.current) return
    const trimmedContent = drafts[mode].trim()
    if (trimmedContent.length === 0) {
      setValidationError('Enter reviewed guidance before publishing.')
      return
    }

    setPendingConfirmation({ mode, content: trimmedContent })
  }

  async function confirmSubmission() {
    const confirmation = pendingConfirmation
    if (confirmation === null) return
    const content =
      confirmation.mode === 'REJECT'
        ? drafts.REJECT.trim()
        : confirmation.content
    if (confirmation.mode === 'REJECT' && content.length === 0) {
      throw new Error('Enter a reason before rejecting this request.')
    }
    const fingerprint = JSON.stringify({
      reviewCaseId,
      version,
      ...confirmation,
      content,
    })
    const idempotencyKey = idempotencyKeyFor(fingerprint)
    await runSubmission(() =>
      confirmation.mode === 'REJECT'
        ? rejectMutation.mutateAsync({
            reviewCaseId,
            idempotencyKey,
            request: {
              expectedVersion: version,
              reason: content,
            },
          })
        : resolveMutation.mutateAsync({
            reviewCaseId,
            idempotencyKey,
            request: {
              expectedVersion: version,
              outcome: confirmation.mode,
              content: confirmation.mode === 'APPROVED' ? null : content,
            },
          }),
    )
  }

  function idempotencyKeyFor(fingerprint: string) {
    if (idempotencyRef.current?.fingerprint !== fingerprint) {
      idempotencyRef.current = { fingerprint, key: crypto.randomUUID() }
    }
    return idempotencyRef.current.key
  }

  async function runSubmission(submit: () => Promise<unknown>) {
    submissionInFlight.current = true
    setValidationError(null)
    setActionError(null)
    try {
      await submit()
      idempotencyRef.current = null
      try {
        window.sessionStorage.removeItem(draftStorageKey)
      } catch {
        // Storage cleanup must not turn a successful terminal action into an error.
      }
      setMode(null)
    } catch (error) {
      setActionError(reviewActionErrorMessage(error))
    } finally {
      submissionInFlight.current = false
    }
  }

  function openEditor(nextMode: EditorMode) {
    if (isPending) return
    setPendingConfirmation(null)
    setMode(nextMode)
    setValidationError(null)
    setActionError(null)
  }

  function updateDraft(modeToUpdate: EditorMode, value: string) {
    const nextDrafts = { ...drafts, [modeToUpdate]: value }
    setDrafts(nextDrafts)
    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          schemaVersion: draftStorageVersion,
          reviewVersion: version,
          drafts: nextDrafts,
        }),
      )
    } catch {
      // A storage failure must not interrupt editing in the current dialog.
    }
  }

  return (
    <section
      className="min-w-0 max-w-full overflow-x-hidden [overflow-wrap:anywhere]"
      aria-labelledby="review-actions-title"
    >
      <h2 id="review-actions-title" className="sr-only">
        Review actions
      </h2>
      <div className="space-y-3 border-t pt-3">
        <div className="flex flex-wrap justify-end gap-2" role="toolbar">
          {canReject ? (
            <Button
              type="button"
              variant="outline"
              disabled={actionsAreLocked}
              onClick={rejectRequest}
              className="border-destructive/70 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Reject
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={actionsAreLocked}
            onClick={() => openEditor('EDITED')}
          >
            Review & Edit
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={actionsAreLocked}
            onClick={approveOriginal}
          >
            Approve
          </Button>
        </div>

        {mode === 'EDITED' && editPortalTarget
          ? createPortal(
              <ReviewEditor
                value={drafts[mode]}
                isPending={isPending}
                validationError={validationError}
                onChange={(value) => {
                  updateDraft(mode, value)
                  if (validationError !== null) setValidationError(null)
                }}
                onCancel={() => setMode(null)}
                onSubmit={() => void submitEditor()}
              />,
              editPortalTarget,
            )
          : null}

        {actionError !== null ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Review action failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <ConfirmDialog
        open={pendingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirmation(null)
        }}
        title="Publish this terminal review outcome?"
        description={
          pendingConfirmation === null ? undefined : (
            <span className="block min-w-0 space-y-3 overflow-x-hidden [overflow-wrap:anywhere]">
              <span className="block">
                {pendingConfirmation.mode === 'REJECT'
                  ? 'Explain why this request is being rejected:'
                  : 'This action is final. The Student-facing result will be:'}
              </span>
              {pendingConfirmation.mode === 'REJECT' ? (
                <Textarea
                  aria-label="Rejection reason"
                  value={drafts.REJECT}
                  disabled={isPending}
                  maxLength={500}
                  rows={3}
                  placeholder="Explain why this request is being closed…"
                  onChange={(event) =>
                    updateDraft('REJECT', event.target.value)
                  }
                />
              ) : (
                <span className="block min-w-0 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-foreground [overflow-wrap:anywhere]">
                  {pendingConfirmation.content}
                </span>
              )}
            </span>
          )
        }
        confirmLabel={
          pendingConfirmation?.mode === 'REJECT'
            ? 'Reject request'
            : 'Publish outcome'
        }
        destructive={pendingConfirmation?.mode === 'REJECT'}
        disabled={isPending}
        onConfirm={confirmSubmission}
      />
    </section>
  )
}

function ReviewEditor({
  value,
  isPending,
  validationError,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: string
  isPending: boolean
  validationError: string | null
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <div className="mt-2 space-y-2 border-t pt-2 text-left">
      <Label htmlFor="review-action-content">Edited guidance</Label>
      <Textarea
        id="review-action-content"
        autoFocus
        value={value}
        disabled={isPending}
        aria-invalid={validationError !== null}
        aria-describedby={
          validationError === null ? undefined : 'review-action-error'
        }
        maxLength={4_000}
        rows={4}
        placeholder="Write the guidance the Student should receive…"
        className="max-w-full [overflow-wrap:anywhere]"
        onChange={(event) => onChange(event.target.value)}
      />
      {validationError !== null ? (
        <p id="review-action-error" className="text-sm text-destructive">
          {validationError}
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={onSubmit}
          variant="default"
          aria-label="Publish guidance"
        >
          <ShieldCheck aria-hidden />
          {isPending ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </div>
  )
}

function reviewActionErrorMessage(error: unknown) {
  if (!isApiError(error)) {
    return 'The review could not be updated. Try again.'
  }
  if (error.code === 'STALE_REVIEW_VERSION') {
    return 'This review changed before your action was submitted. Refresh and try again.'
  }
  if (error.code === 'INVALID_REVIEW_TRANSITION') {
    return 'This review has already been completed and cannot be changed.'
  }
  if (
    error.code === 'REVIEW_INVALID_REQUEST' ||
    error.code === 'OUTCOME_CONTENT_MISMATCH' ||
    error.code === 'AUTOMATIC_CASE_NOT_REJECTABLE'
  ) {
    return 'The review action is no longer valid. Check the current review and try again.'
  }
  return 'The review could not be updated. Try again.'
}

function readStoredDraft(
  storageKey: string,
  reviewVersion: number,
): ReviewDrafts | null {
  try {
    const rawDraft = window.sessionStorage.getItem(storageKey)
    if (rawDraft === null) return null
    const parsed: unknown = JSON.parse(rawDraft)
    if (!isStoredDraft(parsed, reviewVersion)) return null
    return parsed.drafts
  } catch {
    return null
  }
}

function isStoredDraft(
  value: unknown,
  reviewVersion: number,
): value is {
  schemaVersion: 2
  reviewVersion: number
  drafts: ReviewDrafts
} {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (
    candidate.schemaVersion !== draftStorageVersion ||
    candidate.reviewVersion !== reviewVersion ||
    typeof candidate.drafts !== 'object' ||
    candidate.drafts === null
  ) {
    return false
  }
  const drafts = candidate.drafts as Record<string, unknown>
  return (
    typeof drafts.EDITED === 'string' &&
    drafts.EDITED.length <= 4_000 &&
    typeof drafts.REJECT === 'string' &&
    drafts.REJECT.length <= 500
  )
}
