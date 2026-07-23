import { ArrowUp, CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  isStudentChatApiError,
  STUDENT_CHAT_ERROR_CODES,
} from '@/features/student/data/student-chat.errors'
import {
  sendStudentChatMessageRequestSchema,
  studentChatMessageContentSchema,
} from '@/features/student/schemas/student-chat.schema'

const maximumMessageCodePoints = 4_000

interface StudentChatComposerProps {
  hasSelectedSession: boolean
  isGenerating: boolean
  sendError: unknown
  onDismissError: () => void
  onSend: (content: string, clientMessageId: string) => Promise<boolean>
}

export function StudentChatComposer({
  hasSelectedSession,
  isGenerating,
  sendError,
  onDismissError,
  onSend,
}: StudentChatComposerProps) {
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const clientMessageIdRef = useRef<string | null>(null)
  const wasGeneratingRef = useRef(isGenerating)
  const canSend =
    hasSelectedSession &&
    !isGenerating &&
    studentChatMessageContentSchema.safeParse(draft).success

  useEffect(() => {
    const generationFinished = wasGeneratingRef.current && !isGenerating
    wasGeneratingRef.current = isGenerating

    if (generationFinished && hasSelectedSession) {
      textareaRef.current?.focus()
    }
  }, [hasSelectedSession, isGenerating])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSend) {
      return
    }

    clientMessageIdRef.current ??= crypto.randomUUID()
    const parsed = sendStudentChatMessageRequestSchema.safeParse({
      clientMessageId: clientMessageIdRef.current,
      content: draft,
    })
    if (!parsed.success) {
      return
    }

    const wasSent = await onSend(
      parsed.data.content,
      parsed.data.clientMessageId,
    )
    if (wasSent) {
      clientMessageIdRef.current = null
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
    if (canSend) {
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <footer className="shrink-0 bg-gradient-to-t from-background via-background via-80% to-transparent px-4 pt-4 pb-3 sm:px-6">
      <form
        aria-label="Message composer"
        className="mx-auto max-w-3xl"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="glass-paper rounded-2xl p-2 shadow-md shadow-foreground/5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              aria-describedby="chat-composer-hint chat-composer-error"
              aria-invalid={Boolean(sendError)}
              aria-label="Message"
              autoComplete="off"
              className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-3 py-3 pr-12 shadow-none focus-visible:ring-0"
              disabled={!hasSelectedSession || isGenerating}
              name="chat-message"
              onChange={(event) => {
                setDraft(limitMessageDraft(event.target.value))
                clientMessageIdRef.current = null
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
              rows={1}
              value={draft}
            />
            <Button
              aria-label="Send message"
              className="absolute right-1 bottom-1 size-9 rounded-full bg-primary text-primary-foreground shadow-none disabled:bg-muted disabled:text-muted-foreground"
              disabled={!canSend}
              size="icon"
              type="submit"
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <p
          id="chat-composer-hint"
          className="mt-2 text-center text-xs text-muted-foreground"
        >
          AI responses can be inaccurate. Check important course information.
        </p>

        {sendError ? (
          <div
            id="chat-composer-error"
            className="mt-2 flex items-start gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground"
            role="alert"
          >
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p>{sendErrorMessage(sendError)}</p>
          </div>
        ) : (
          <span id="chat-composer-error" />
        )}
      </form>
    </footer>
  )
}

function limitMessageDraft(value: string) {
  const trimmed = value.trim()
  const codePoints = Array.from(trimmed)

  if (codePoints.length <= maximumMessageCodePoints) {
    return value
  }

  const leadingWhitespace = value.slice(0, value.indexOf(trimmed))
  return `${leadingWhitespace}${codePoints
    .slice(0, maximumMessageCodePoints)
    .join('')}`
}

function sendErrorMessage(error: unknown) {
  if (isStudentChatApiError(error, STUDENT_CHAT_ERROR_CODES.TURN_IN_PROGRESS)) {
    return 'This conversation is already generating a response. Refresh the history before trying again.'
  }
  if (
    isStudentChatApiError(error, STUDENT_CHAT_ERROR_CODES.SESSION_NOT_FOUND)
  ) {
    return 'This conversation is no longer available.'
  }
  if (
    isStudentChatApiError(
      error,
      STUDENT_CHAT_ERROR_CODES.TERMINAL_STATE_UNAVAILABLE,
    )
  ) {
    return 'Your message may have been saved, but its final state could not be confirmed. Refresh the history before retrying.'
  }

  return 'Your message could not be sent. It remains in the composer so you can try again.'
}
