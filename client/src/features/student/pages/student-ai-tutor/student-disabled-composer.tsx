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
    <footer className="bg-gradient-to-t from-background via-background to-transparent px-4 pt-3 pb-5 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10">
        <div className="relative">
          <Textarea
            aria-label="Message"
            disabled
            placeholder={
              hasSelectedSession
                ? 'Message sending is not available yet.'
                : 'Select a conversation first.'
            }
            name="chat-message"
            autoComplete="off"
            className="min-h-24 resize-none border-0 bg-transparent px-3 pt-2 pb-12 shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            disabled
            aria-label="Send message"
            className="absolute right-1 bottom-1 size-9 rounded-[10px] bg-primary text-primary-foreground"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-5xl text-center text-xs text-muted-foreground">
        Sending will be enabled in the next Student Chat story.
      </p>
    </footer>
  )
}
