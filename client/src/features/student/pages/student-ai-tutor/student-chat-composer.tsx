import { CircleAlert, LoaderCircle, SendHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isApiError } from '@/features/auth/api/authenticated-api-client'
import { sendStudentChatMessageRequestSchema } from '@/features/student/schemas/student-chat.schema'

interface StudentChatComposerProps {
  hasSelectedSession: boolean
  isGenerating: boolean
  sendError: unknown
  onDismissError: () => void
  onSend: (content: string) => Promise<boolean>
}

export function StudentChatComposer({
  hasSelectedSession,
  isGenerating,
  sendError,
  onDismissError,
  onSend,
}: StudentChatComposerProps) {
  const [draft, setDraft] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const canSend = hasSelectedSession && !isGenerating && draft.trim().length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = sendStudentChatMessageRequestSchema.safeParse({
      content: draft,
    })
    if (!parsed.success) {
      setValidationError(
        draft.trim().length === 0
          ? 'Enter a question before sending.'
          : 'Keep your question within 4,000 characters.',
      )
      return
    }

    setValidationError(null)
    const wasSent = await onSend(parsed.data.content)
    if (wasSent) {
      setDraft('')
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <footer className="bg-gradient-to-t from-background via-background to-transparent px-4 pt-3 pb-5 sm:px-8">
      <form
        aria-label="Message composer"
        className="mx-auto max-w-5xl"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="rounded-3xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10">
          <div className="relative">
            <Textarea
              aria-describedby="chat-composer-status chat-composer-error"
              aria-invalid={validationError !== null || Boolean(sendError)}
              aria-label="Message"
              autoComplete="off"
              className="min-h-24 resize-none border-0 bg-transparent px-3 pt-2 pb-12 shadow-none focus-visible:ring-0"
              disabled={!hasSelectedSession || isGenerating}
              name="chat-message"
              onChange={(event) => {
                setDraft(event.target.value)
                setValidationError(null)
                if (sendError) {
                  onDismissError()
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                hasSelectedSession
                  ? 'Ask a conceptual question about this course…'
                  : 'Select a conversation first.'
              }
              value={draft}
            />
            <Button
              aria-label="Send message"
              className="absolute right-1 bottom-1 size-9 rounded-[10px] bg-primary text-primary-foreground"
              disabled={!canSend}
              size="icon"
              type="submit"
            >
              {isGenerating ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <SendHorizontal className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        <div
          id="chat-composer-status"
          aria-atomic="true"
          aria-live="polite"
          className="mt-2 min-h-5 text-center text-xs text-muted-foreground"
          role="status"
        >
          {isGenerating
            ? 'Grounding your question in course materials…'
            : 'Press Enter to send. Use Shift+Enter for a new line.'}
        </div>

        <div id="chat-composer-error" className="mt-2">
          {validationError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          ) : sendError ? (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{sendErrorMessage(sendError)}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </form>
    </footer>
  )
}

function sendErrorMessage(error: unknown) {
  if (isApiError(error)) {
    switch (error.code) {
      case 'STUDENT_CHAT_TURN_IN_PROGRESS':
        return 'This conversation is already generating a response. Refresh the history before trying again.'
      case 'STUDENT_CHAT_SESSION_NOT_FOUND':
        return 'This conversation is no longer available.'
      case 'STUDENT_CHAT_TERMINAL_STATE_UNAVAILABLE':
        return 'Your message may have been saved, but its final state could not be confirmed. Refresh the history before retrying.'
      default:
        break
    }
  }

  return 'Your message could not be sent. It remains in the composer so you can try again.'
}
