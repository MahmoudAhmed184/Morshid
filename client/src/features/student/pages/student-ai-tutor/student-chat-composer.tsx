import { ArrowUp, CircleAlert } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
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

export interface StudentChatComposerHandle {
  prefill: (text: string) => void
  submitWith: (text: string, clientMessageId: string) => void
  focus: () => void
}

interface StudentChatComposerProps {
  isGenerating: boolean
  sendError: unknown
  onDismissError: () => void
  onSend: (content: string, clientMessageId: string) => Promise<boolean>
}

export const StudentChatComposer = forwardRef<
  StudentChatComposerHandle,
  StudentChatComposerProps
>(function StudentChatComposerImpl(
  { isGenerating, sendError, onDismissError, onSend },
  ref,
) {
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const clientMessageIdRef = useRef<string | null>(null)
  const autoSubmitRef = useRef(false)
  const wasGeneratingRef = useRef(isGenerating)
  const canSend =
    !isGenerating && studentChatMessageContentSchema.safeParse(draft).success

  useImperativeHandle(ref, () => ({
    prefill: (text: string) => {
      setDraft(limitMessageDraft(text))
      clientMessageIdRef.current = null
      textareaRef.current?.focus()
    },
    // T15.2 — hand the draft's first message to the freshly-created session so
    // the send runs through the normal composer submit path (optimistic append,
    // and, on failure, the message stays in this composer with the same
    // clientMessageId ready to retry).
    submitWith: (text: string, clientMessageId: string) => {
      setDraft(limitMessageDraft(text))
      clientMessageIdRef.current = clientMessageId
      autoSubmitRef.current = true
    },
    // T15.7 — the sidebar's New chat / collapsed `+` focus the draft composer
    // through the chrome context after entering the draft state.
    focus: () => {
      textareaRef.current?.focus()
    },
  }))

  useEffect(() => {
    const generationFinished = wasGeneratingRef.current && !isGenerating
    wasGeneratingRef.current = isGenerating

    if (generationFinished) {
      textareaRef.current?.focus()
    }
  }, [isGenerating])

  useEffect(() => {
    if (autoSubmitRef.current && canSend) {
      autoSubmitRef.current = false
      formRef.current?.requestSubmit()
    }
  }, [canSend])

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
    <form
      ref={formRef}
      aria-label="Message composer"
      className="shrink-0"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="mx-auto max-w-3xl rounded-t-2xl border border-b-0 border-border/70 bg-card/80 shadow-[0_-8px_24px_-16px] shadow-foreground/10 backdrop-blur-md focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        <Textarea
          ref={textareaRef}
          aria-describedby="chat-composer-hint chat-composer-error"
          aria-invalid={Boolean(sendError)}
          aria-label="Message"
          autoComplete="off"
          className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-4 pt-3.5 pb-1 shadow-none focus-visible:ring-0"
          disabled={isGenerating}
          name="chat-message"
          onChange={(event) => {
            setDraft(limitMessageDraft(event.target.value))
            clientMessageIdRef.current = null
            if (sendError) {
              onDismissError()
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask a conceptual question about this course…"
          rows={1}
          value={draft}
        />
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2.5">
          <p id="chat-composer-hint" className="footnote text-muted-foreground">
            AI responses can be inaccurate. Check important course information.
          </p>
          <Button
            aria-label="Send message"
            className="size-9 rounded-xl bg-primary text-primary-foreground shadow-none disabled:bg-muted disabled:text-muted-foreground"
            disabled={!canSend}
            size="icon"
            type="submit"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {sendError ? (
        <div
          id="chat-composer-error"
          className="mx-auto mt-2 flex max-w-3xl items-start gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground"
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
  )
})

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
