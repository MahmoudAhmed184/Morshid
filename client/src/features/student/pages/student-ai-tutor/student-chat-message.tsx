import {
  BookMarked,
  ClipboardCheck,
  FileText,
  GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

interface StudentChatMessageProps {
  message: ChatMessage
}

type GuidanceLabel = NonNullable<ChatMessage['guidanceLabel']>

const guidancePresentation: Record<
  GuidanceLabel,
  { label: string; className: string; icon?: LucideIcon }
> = {
  COURSE_GROUNDED: {
    label: 'GROUNDED IN COURSE SOURCES',
    className: 'border-success/25 bg-success/10 text-success',
    icon: FileText,
  },
  GENERAL_NOT_FOUND: {
    label: 'GENERAL GUIDANCE · NOT FROM COURSE SOURCES',
    className: 'border-border bg-secondary text-muted-foreground',
  },
  UNCERTAIN_AWAITING_REVIEW: {
    label: 'AWAITING INSTRUCTOR REVIEW',
    className: 'border-warning/25 bg-warning/10 text-warning',
    icon: ClipboardCheck,
  },
  INSTRUCTOR_REVIEWED: {
    label: 'INSTRUCTOR-REVIEWED',
    className: 'border-gold/25 bg-gold/10 text-gold',
    icon: BookMarked,
  },
  REFUSAL: {
    label: 'GUIDANCE REFUSED',
    className: 'border-border bg-secondary text-muted-foreground',
  },
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
      <div className="max-w-[min(90%,44rem)]">
        <div
          className={cn(
            'px-4 py-3 text-sm leading-7',
            isStudent
              ? 'rounded-2xl rounded-br-lg bg-accent text-foreground'
              : 'rounded-2xl rounded-bl-lg border bg-card text-card-foreground shadow-xs',
          )}
        >
          <span className="sr-only">{isStudent ? 'You' : 'AI Tutor'}: </span>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {!isStudent && message.citations.length > 0 ? (
            <div
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Message citations"
            >
              {message.citations.map((citation) => (
                <Badge
                  key={`${citation.materialId}-${citation.order}`}
                  variant="outline"
                  className="max-w-full font-mono"
                >
                  <span className="truncate">
                    [{citation.order}] {citation.materialTitle}
                  </span>
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {!isStudent && message.guidanceLabel ? (
          <GuidanceBadge guidanceLabel={message.guidanceLabel} />
        ) : null}
      </div>
    </li>
  )
}

function GuidanceBadge({ guidanceLabel }: { guidanceLabel: GuidanceLabel }) {
  const presentation = guidancePresentation[guidanceLabel]
  const Icon = presentation.icon

  return (
    <div className="mt-2">
      <Badge
        variant="outline"
        className={cn('gap-1.5 font-mono', presentation.className)}
      >
        {Icon ? <Icon className="size-3" aria-hidden /> : null}
        {presentation.label}
      </Badge>
    </div>
  )
}
