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
    <footer className="border-t border-border px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-xl border border-border bg-background p-3 shadow-sm">
        <Textarea
          aria-label="Message"
          disabled
          placeholder={
            hasSelectedSession
              ? 'Message sending is not available yet.'
              : 'Select a conversation first.'
          }
          className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Sending will be enabled in the next Student Chat story.
          </p>
          <Button type="button" disabled aria-label="Send message">
            <SendHorizontal className="size-4" aria-hidden />
            Send
          </Button>
        </div>
      </div>
    </footer>
  )
}
