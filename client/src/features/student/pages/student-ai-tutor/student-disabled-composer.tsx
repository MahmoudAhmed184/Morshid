import { SendHorizontal, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface StudentDisabledComposerProps {
  hasSelectedSession: boolean
}

export function StudentDisabledComposer({
  hasSelectedSession,
}: StudentDisabledComposerProps) {
  return (
    <footer className="bg-gradient-to-t from-background via-background to-transparent px-4 pt-4 pb-5 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="group rounded-3xl border border-border bg-card p-2 shadow-sm ring-1 ring-foreground/[0.03] transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
          <div className="relative">
            <Textarea
              aria-label="Message"
              disabled
              placeholder={
                hasSelectedSession
                  ? 'Ask your tutor anything about this course…'
                  : 'Select a conversation to begin.'
              }
              name="chat-message"
              autoComplete="off"
              className="min-h-24 resize-none border-0 bg-transparent px-3 pt-2.5 pb-12 text-base leading-6 shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
            />
            <Button
              type="button"
              size="icon"
              disabled
              aria-label="Send message"
              className="absolute right-1 bottom-1 size-9 rounded-xl bg-primary text-primary-foreground shadow-xs"
            >
              <SendHorizontal className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-gold" aria-hidden />
          Live tutoring arrives in the next Student Chat story — your saved
          history is ready.
        </p>
      </div>
    </footer>
  )
}
