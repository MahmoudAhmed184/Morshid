import { Bot, GraduationCap, Info } from 'lucide-react'

import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

interface StudentChatMessageProps {
  message: ChatMessage
}

export function StudentChatMessage({ message }: StudentChatMessageProps) {
  const isStudent = message.role === 'STUDENT'
  const isSystem = message.role === 'SYSTEM'

  return (
    <li
      className={cn(
        'flex gap-3',
        isStudent ? 'flex-row-reverse' : 'flex-row',
        isSystem && 'justify-center',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isStudent
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground',
          isSystem && 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : isSystem ? (
          <Info className="size-4" />
        ) : (
          <Bot className="size-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6',
          isStudent
            ? 'rounded-tr-md bg-secondary text-secondary-foreground'
            : 'rounded-tl-md bg-muted text-foreground',
          isSystem && 'rounded-md border border-border bg-background',
        )}
      >
        <span className="sr-only">
          {isStudent ? 'You' : isSystem ? 'System' : 'AI Tutor'}:{' '}
        </span>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </li>
  )
}
