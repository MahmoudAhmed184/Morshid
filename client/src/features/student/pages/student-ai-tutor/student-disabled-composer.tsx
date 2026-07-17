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
    <footer className="border-t border-border p-4">
      <div className="rounded-md border border-border bg-background p-3">
        <Textarea
          aria-label="Message"
          disabled
          placeholder={
            hasSelectedSession
              ? 'Message sending is not available yet.'
              : 'Select a conversation first.'
          }
          className="min-h-20 resize-none bg-transparent"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Message sending and grounded guidance arrive in S2-4.
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
