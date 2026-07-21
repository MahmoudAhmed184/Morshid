import { GraduationCap, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { GuidingStar } from './guiding-star'

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
          'flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-1',
          isStudent
            ? 'bg-secondary text-secondary-foreground ring-foreground/8'
            : 'bg-[linear-gradient(140deg,var(--primary),oklch(0.56_0.2_305))] text-primary-foreground ring-white/15',
        )}
        aria-hidden
      >
        {isStudent ? (
          <GraduationCap className="size-4" />
        ) : (
          <GuidingStar className="size-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-left text-sm leading-6',
          isStudent
            ? 'rounded-tr-md bg-secondary text-secondary-foreground'
            : 'rounded-tl-md bg-muted text-foreground ring-1 ring-foreground/5',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex flex-row gap-3" aria-hidden>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,var(--primary),oklch(0.56_0.2_305))] text-primary-foreground shadow-xs ring-1 ring-white/15">
        <GuidingStar className="size-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-muted px-4 py-3.5 ring-1 ring-foreground/5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
            style={{ animationDelay: `${dot * 140}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function CitationChip() {
  return (
    <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-4xl bg-info/12 px-2.5 py-1 font-mono text-[0.7rem] text-[color-mix(in_oklab,var(--info)_72%,var(--foreground))]">
      <Sparkles className="size-3" aria-hidden />
      lecture-08-quicksort.pdf · p.12
    </span>
  )
}

function WindowChrome() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="size-3 rounded-full bg-muted-foreground/25" />
      <span className="size-3 rounded-full bg-muted-foreground/40" />
      <span className="size-3 rounded-full bg-gold/70" />
    </div>
  )
}

type Stage = 'thinking' | 'answered'

export function ChatPreviewCard() {
  const [stage, setStage] = useState<Stage>('thinking')

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    // Reduced-motion users skip straight to the answered state; everyone else
    // watches the tutor "think" first.
    const timer = window.setTimeout(
      () => setStage('answered'),
      prefersReduced ? 0 : 2200,
    )
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl bg-card text-left ring-1 ring-foreground/10 shadow-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-border/70 bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-4">
          <WindowChrome />
          <p className="text-sm font-semibold text-card-foreground sm:text-base">
            Data Structures &amp; Algorithms
          </p>
        </div>
        <Badge variant="success" className="shrink-0 gap-1.5">
          <span
            className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none"
            aria-hidden
          />
          Live session
        </Badge>
      </div>

      <div
        className="space-y-5 px-5 py-6"
        aria-label="Socratic tutoring preview"
      >
        <ChatMessage role="student">
          I don&apos;t understand how quicksort achieves O(n log n) time
          complexity.
        </ChatMessage>

        {stage === 'thinking' ? (
          <TypingBubble />
        ) : (
          <div className="animate-fade-up motion-reduce:animate-none">
            <ChatMessage role="ai">
              Let&apos;s reason it out together. Quicksort splits the array
              around a pivot. In the ideal case, how large are the two
              sub-arrays you still have to sort?
              <span className="block">
                <CitationChip />
              </span>
            </ChatMessage>
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
        <div className="flex h-11 items-center gap-2 rounded-full border border-input bg-background px-4 text-sm text-muted-foreground shadow-xs">
          <span>Roughly half each…</span>
          <span
            className="inline-block h-4 w-px animate-pulse bg-primary motion-reduce:animate-none"
            aria-hidden
          />
          <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow-primary">
            <GuidingStar className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
