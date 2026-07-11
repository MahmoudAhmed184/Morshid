import { MessageSquareText, SendHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
          <p className="text-sm text-zinc-400">Student Workspace</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            AI Tutor
          </h1>
        </div>
      </div>

      <section
        className="flex min-h-96 flex-1 flex-col rounded-md border border-white/10 bg-zinc-950/40"
        aria-labelledby="student-chat-title"
      >
        <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.12em] text-zinc-500 uppercase">
              Course Context
            </p>
            <h2
              id="student-chat-title"
              className="mt-1 truncate text-base font-semibold text-white"
            >
              {selectedCourse?.title ?? 'No course selected'}
            </h2>
            <p className="mt-1 truncate text-sm text-zinc-500">
              {selectedCourse?.code ??
                'Select an assigned course when course chat is connected.'}
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-amber-300/30 text-amber-200"
          >
            Chat not connected
          </Badge>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-teal-500/15 text-teal-200">
              <MessageSquareText className="size-6" aria-hidden />
            </div>
            <h3 className="text-lg font-semibold text-white">
              No conversation yet
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Course-grounded chat is not available yet. This area is reserved
              for Sprint 2 integration.
            </p>
          </div>
        </div>

        <footer className="border-t border-white/10 p-4">
          <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
            <Textarea
              aria-label="Message"
              disabled
              placeholder="Chat is not connected yet."
              className="min-h-20 resize-none border-white/10 bg-transparent text-zinc-100 placeholder:text-zinc-500"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
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
