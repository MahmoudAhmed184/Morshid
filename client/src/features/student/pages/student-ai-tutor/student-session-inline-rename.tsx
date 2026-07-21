import { useState } from 'react'

import { Input } from '@/components/ui/input'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

interface StudentSessionInlineRenameProps {
  session: ChatSession
  isSelected: boolean
  isPending: boolean
  onCancel: () => void
  onComplete: () => void
  onRename: (title: string) => Promise<void>
}

export function StudentSessionInlineRename({
  session,
  isSelected,
  isPending,
  onCancel,
  onComplete,
  onRename,
}: StudentSessionInlineRenameProps) {
  const [title, setTitle] = useState(session.title)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const commitRename = async () => {
    if (isPending) {
      return
    }

    const trimmedTitle = title.trim()

    if (trimmedTitle.length === 0) {
      setErrorMessage('Enter a conversation title.')
      return
    }

    if (trimmedTitle === session.title) {
      onCancel()
      return
    }

    setErrorMessage(null)

    try {
      await onRename(trimmedTitle)
      onComplete()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to rename this conversation.',
      )
    }
  }

  return (
    <form
      className={cn(
        'rounded-xl px-2 py-2',
        isSelected ? 'bg-sidebar-accent' : 'bg-secondary/60',
      )}
      onSubmit={(event) => {
        event.preventDefault()
        void commitRename()
      }}
    >
      <Input
        autoFocus
        aria-label={`Rename ${session.title}`}
        aria-invalid={errorMessage !== null}
        name="conversation-title"
        value={title}
        maxLength={160}
        autoComplete="off"
        disabled={isPending}
        className="h-8 bg-background text-sm text-foreground"
        onBlur={() => {
          if (!errorMessage) {
            void commitRename()
          }
        }}
        onChange={(event) => {
          setTitle(event.target.value)
          setErrorMessage(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      {errorMessage ? (
        <p role="alert" className="mt-1 px-1 text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </form>
  )
}
