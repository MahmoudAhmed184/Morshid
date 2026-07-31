import { useRef, useState } from 'react'
import {
  CheckCircle2,
  FilePenLine,
  LockKeyhole,
  RefreshCcw,
  Save,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useRejectInstructorReview,
  useResolveInstructorReview,
} from '@/features/instructor/hooks/use-instructor-reviews'
import { isApiError } from '@/lib/api/http'

type EditorMode = 'EDITED' | 'REPLACED' | 'REJECT'
type ReviewDrafts = Record<EditorMode, string>

const draftStorageVersion = 1

export function InstructorReviewActionPanel({
  reviewCaseId,
  version,
  canReject,
  originalContent,
}: {
  reviewCaseId: string
  version: number
  canReject: boolean
  originalContent: string
}) {
  const resolveMutation = useResolveInstructorReview()
  const rejectMutation = useRejectInstructorReview()
  const submissionInFlight = useRef(false)
  const [mode, setMode] = useState<EditorMode | null>(null)
  const draftStorageKey = `morshid:review-draft:${reviewCaseId}`
  const [drafts, setDrafts] = useState<ReviewDrafts>(
    () =>
      readStoredDraft(draftStorageKey, version) ?? {
        EDITED: originalContent,
        REPLACED: '',
        REJECT: '',
      },
  )
  const [draftSaved, setDraftSaved] = useState(
    () => readStoredDraft(draftStorageKey, version) !== null,
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const isPending = resolveMutation.isPending || rejectMutation.isPending

  async function approveOriginal() {
    if (isPending || submissionInFlight.current) return
    await runSubmission(() =>
      resolveMutation.mutateAsync({
        reviewCaseId,
        idempotencyKey: crypto.randomUUID(),
        request: {
          expectedVersion: version,
          outcome: 'APPROVED',
          content: null,
        },
      }),
    )
  }

  async function submitEditor() {
    if (mode === null || isPending || submissionInFlight.current) return
    const trimmedContent = drafts[mode].trim()
    if (trimmedContent.length === 0) {
      setValidationError(
        mode === 'REJECT'
          ? 'Enter a reason before rejecting this request.'
          : 'Enter reviewed guidance before publishing.',
      )
      return
    }

    await runSubmission(() =>
      mode === 'REJECT'
        ? rejectMutation.mutateAsync({
            reviewCaseId,
            idempotencyKey: crypto.randomUUID(),
            request: { expectedVersion: version, reason: trimmedContent },
          })
        : resolveMutation.mutateAsync({
            reviewCaseId,
            idempotencyKey: crypto.randomUUID(),
            request: {
              expectedVersion: version,
              outcome: mode,
              content: trimmedContent,
            },
          }),
    )
  }

  async function runSubmission(submit: () => Promise<unknown>) {
    submissionInFlight.current = true
    setValidationError(null)
    setActionError(null)
    try {
      await submit()
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
    setMode(nextMode)
    setValidationError(null)
    setActionError(null)
  }

  function saveDraft() {
    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          schemaVersion: draftStorageVersion,
          reviewVersion: version,
          drafts,
        }),
      )
      setDraftSaved(true)
      setActionError(null)
    } catch {
      setActionError('The draft could not be saved in this browser.')
    }
  }

  return (
    <section aria-labelledby="review-actions-title">
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="gap-3 border-b bg-muted/20 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FilePenLine className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle id="review-actions-title" className="text-sm">
                  Review actions
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Prepare the Student-facing outcome
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.68rem] text-muted-foreground">
              <LockKeyhole className="size-3" aria-hidden />
              Private
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Choose exactly what should be published. The original response
            remains read-only.
          </p>

          <div className="grid gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => void approveOriginal()}
              className="justify-start bg-success text-success-foreground hover:bg-success/85"
            >
              <CheckCircle2 aria-hidden />
              Approve original guidance
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => openEditor('EDITED')}
              className="justify-start border-info/30 bg-info/10 text-info hover:bg-info/15 hover:text-info"
            >
              <FilePenLine aria-hidden />
              Publish edited guidance
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => openEditor('REPLACED')}
              className="justify-start border-gold/30 bg-gold/10 text-gold hover:bg-gold/15 hover:text-gold"
            >
              <RefreshCcw aria-hidden />
              Publish replacement guidance
            </Button>
            {canReject ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => openEditor('REJECT')}
                className="justify-start bg-destructive text-destructive-foreground hover:bg-destructive/85"
              >
                <XCircle aria-hidden />
                Reject request
              </Button>
            ) : null}
          </div>

          {mode !== null ? (
            <div className="space-y-3 rounded-xl border bg-background p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="review-action-content">
                  {mode === 'REJECT'
                    ? 'Rejection reason'
                    : mode === 'EDITED'
                      ? 'Edited guidance'
                      : 'Replacement guidance'}
                </Label>
                <span className="text-[0.68rem] text-muted-foreground">
                  Local draft · Version {version}
                </span>
              </div>
              <Textarea
                id="review-action-content"
                value={drafts[mode]}
                disabled={isPending}
                aria-invalid={validationError !== null}
                aria-describedby={
                  validationError === null ? undefined : 'review-action-error'
                }
                maxLength={mode === 'REJECT' ? 500 : 4_000}
                rows={mode === 'REJECT' ? 4 : 10}
                placeholder={
                  mode === 'REJECT'
                    ? 'Explain why this request is being closed…'
                    : 'Write the guidance the Student should receive…'
                }
                onChange={(event) => {
                  setDrafts((current) => ({
                    ...current,
                    [mode]: event.target.value,
                  }))
                  setDraftSaved(false)
                  if (validationError !== null) setValidationError(null)
                }}
              />
              {validationError !== null ? (
                <p
                  id="review-action-error"
                  className="text-sm text-destructive"
                >
                  {validationError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => setMode(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={saveDraft}
                  className="border-info/30 bg-info/10 text-info hover:bg-info/15 hover:text-info"
                >
                  <Save aria-hidden />
                  Save draft
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => void submitEditor()}
                  variant={mode === 'REJECT' ? 'destructive' : 'default'}
                  className={
                    mode === 'REJECT'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/85'
                      : 'bg-success text-success-foreground hover:bg-success/85'
                  }
                >
                  {mode === 'REJECT' ? (
                    <XCircle aria-hidden />
                  ) : (
                    <ShieldCheck aria-hidden />
                  )}
                  {isPending
                    ? 'Publishing…'
                    : mode === 'REJECT'
                      ? 'Confirm rejection'
                      : 'Publish guidance'}
                </Button>
              </div>
              <p className="text-[0.68rem] leading-5 text-muted-foreground">
                {draftSaved
                  ? 'Draft saved in this browser for this tab.'
                  : 'Unsaved changes remain available until this page is refreshed.'}
              </p>
            </div>
          ) : null}

          <Alert className="border-warning/35 bg-warning/[0.07] py-3">
            <TriangleAlert aria-hidden />
            <AlertDescription className="text-xs leading-5">
              Publishing creates a separate reviewed outcome. It cannot modify
              the original AI response.
            </AlertDescription>
          </Alert>

          <div className="flex items-start gap-2 rounded-lg bg-primary/8 px-3 py-2.5 text-xs leading-5 text-primary">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Students only receive guidance you explicitly publish.
          </div>

          {actionError !== null ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Review action failed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
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
  schemaVersion: 1
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
    typeof drafts.REPLACED === 'string' &&
    drafts.REPLACED.length <= 4_000 &&
    typeof drafts.REJECT === 'string' &&
    drafts.REJECT.length <= 500
  )
}
