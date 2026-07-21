import { SendHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface StudentDisabledComposerProps {
  hasSelectedSession: boolean
}

export function StudentDisabledComposer({
  hasSelectedSession,
}: StudentDisabledComposerProps) {
  return (
    <footer className="bg-background px-6 pt-4 pb-5">
      <div className="mx-auto max-w-3xl">
        <div className="glass-paper rounded-2xl p-2 shadow-md">
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
              className="absolute right-1 bottom-1 size-9 rounded-full"
            >
              <SendHorizontal className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
        <p className="footnote mt-2.5 text-center">
          Live tutoring arrives in the next Student Chat story — your saved
          history is ready.
        </p>
      </div>
    </footer>
  )
}
