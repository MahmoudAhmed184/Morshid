import { GraduationCap } from 'lucide-react'

import { Logo } from '@/components/logo'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

interface StudentChatMessageProps {
  message: ChatMessage
}

export function StudentChatMessage({ message }: StudentChatMessageProps) {
  const isStudent = message.role === 'STUDENT'
  const isSystem = message.role === 'SYSTEM'

  if (isSystem) {
    return (
      <li className="flex justify-center">
        <p className="footnote max-w-prose break-words text-center">
          <span className="sr-only">System: </span>
          {message.content}
        </p>
      </li>
    )
  }

  return (
    <li
      className={cn(
        'flex items-end gap-3',
        isStudent ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isStudent
            ? 'bg-secondary text-foreground'
            : 'bg-primary/10 text-primary',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : (
          <Logo className="size-8" iconClassName="size-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[min(90%,44rem)] px-4 py-3 text-sm leading-7',
          isStudent
            ? 'rounded-2xl rounded-br-lg bg-accent text-foreground'
            : 'rounded-2xl rounded-bl-lg border bg-card text-card-foreground shadow-xs',
        )}
      >
        <span className="sr-only">{isStudent ? 'You' : 'AI Tutor'}: </span>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </li>
  )
}
