import { GraduationCap, Info } from 'lucide-react'

import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

interface StudentChatMessageProps {
  message: ChatMessage
}

/**
 * The eight-pointed "guiding star" mark, echoing the Morshid logo, used as the
 * AI tutor's avatar so its voice reads as the guide rather than a generic bot.
 */
function TutorStarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.8 4.8h14.4v14.4H4.8zM12 1.5l10.5 10.5L12 22.5 1.5 12z"
        opacity="0.95"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

export function StudentChatMessage({ message }: StudentChatMessageProps) {
  const isStudent = message.role === 'STUDENT'
  const isSystem = message.role === 'SYSTEM'

  if (isSystem) {
    return (
      <li className="flex justify-center">
        <div className="flex max-w-prose items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-xs leading-5 text-muted-foreground">
          <Info className="size-3.5 shrink-0 text-info" aria-hidden />
          <span className="sr-only">System: </span>
          <p className="min-w-0 break-words">{message.content}</p>
        </div>
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
          'flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-1 ring-inset',
          isStudent
            ? 'bg-secondary text-secondary-foreground ring-border'
            : 'bg-[linear-gradient(140deg,var(--primary),oklch(0.56_0.2_305))] text-primary-foreground ring-white/15',
        )}
        aria-hidden
      >
        {isStudent ? <GraduationCap className="size-4" /> : <TutorStarMark />}
      </div>
      <div
        className={cn(
          'max-w-[min(90%,44rem)] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm transition-shadow',
          isStudent
            ? 'rounded-br-md bg-[linear-gradient(160deg,var(--primary),oklch(0.47_0.2_285))] text-primary-foreground'
            : 'rounded-bl-md border border-border bg-card text-card-foreground ring-1 ring-foreground/[0.04]',
        )}
      >
        <span className="sr-only">{isStudent ? 'You' : 'AI Tutor'}: </span>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </li>
  )
}
