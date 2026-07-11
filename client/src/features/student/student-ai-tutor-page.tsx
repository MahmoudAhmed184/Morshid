import { MessageSquareText, SendHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export function StudentAiTutorPage() {
  const selectedCourse =
    useAuthStore((state) =>
      state.user?.courses.find((course) => course.membershipRole === 'STUDENT'),
    ) ?? null

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Student Workspace</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            AI Tutor
          </h1>
        </div>
      </div>

      <section
        className="flex min-h-96 flex-1 flex-col rounded-md border border-border bg-card text-card-foreground"
        aria-labelledby="student-chat-title"
      >
        <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Course Context
            </p>
            <h2
              id="student-chat-title"
              className="mt-1 truncate text-base font-semibold text-card-foreground"
            >
              {selectedCourse?.title ?? 'No course selected'}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {selectedCourse?.code ??
                'Select an assigned course when course chat is connected.'}
            </p>
          </div>
          <Badge variant="outline" className="w-fit">
            Chat not connected
          </Badge>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <EmptyState
            icon={<MessageSquareText className="size-6" aria-hidden />}
            title="No conversation yet"
            description="Course-grounded chat is not available yet. This area is reserved for Sprint 2 integration."
            className="w-full max-w-md border-0 bg-transparent"
          />
        </div>

        <footer className="border-t border-border p-4">
          <div className="rounded-md border border-border bg-background p-3">
            <Textarea
              aria-label="Message"
              disabled
              placeholder="Chat is not connected yet."
              className="min-h-20 resize-none bg-transparent"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Chat is not available yet. Messages cannot be sent.
              </p>
              <Button type="button" disabled aria-label="Send message">
                <SendHorizontal className="size-4" aria-hidden />
                Send
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  )
}
