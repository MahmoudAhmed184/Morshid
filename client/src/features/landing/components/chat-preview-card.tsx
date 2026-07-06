import { Bot, GraduationCap, Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ChatMessageProps = {
  role: 'student' | 'ai'
  children: React.ReactNode
  className?: string
}

function ChatMessage({ role, children, className }: ChatMessageProps) {
  const isStudent = role === 'student'

  return (
    <div
      className={cn(
        'flex gap-3',
        isStudent ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isStudent
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : (
          <Bot className="size-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-left text-sm leading-6',
          isStudent
            ? 'rounded-tr-md bg-secondary text-secondary-foreground'
            : 'rounded-tl-md bg-muted text-foreground',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function WindowChrome() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="size-3 rounded-full bg-muted-foreground/30" />
      <span className="size-3 rounded-full bg-muted-foreground/50" />
      <span className="size-3 rounded-full bg-primary/60" />
    </div>
  )
}

export function ChatPreviewCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg ring-1 ring-border/60 shadow-primary/5">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <WindowChrome />
          <p className="text-sm font-semibold text-card-foreground sm:text-base">
            Data Structures &amp; Algorithms
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          Active Session
        </Badge>
      </div>

      <div className="space-y-5 px-5 py-6" aria-label="Chat preview">
        <ChatMessage role="student">
          I don&apos;t understand how quicksort achieves O(n log n) time
          complexity.
        </ChatMessage>
        <ChatMessage role="ai">
          Let&apos;s break it down together. Quicksort uses a divide-and-conquer
          strategy. When we pick a pivot and partition the array, what happens
          to the size of the sub-arrays we need to sort next in the ideal case?
        </ChatMessage>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="relative">
          <Input
            readOnly
            placeholder="Type your answer..."
            aria-label="Chat input preview"
            className="h-11 pr-12"
          />
          <div
            className="pointer-events-none absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden
          >
            <Send className="size-3.5" />
          </div>
        </div>
      </div>
    </div>
  )
}
