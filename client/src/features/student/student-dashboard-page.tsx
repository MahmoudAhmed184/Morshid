import { BookOpen, MessageSquareText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export function StudentDashboardPage() {
  const assignedCourseCount =
    useAuthStore(
      (state) =>
        state.user?.courses.filter(
          (course) => course.membershipRole === 'STUDENT',
        ).length,
    ) ?? 0

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mb-5">
        <p className="text-sm text-zinc-400">Student Workspace</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Dashboard
        </h1>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-md border border-white/10 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">Assigned courses</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {assignedCourseCount}
              </p>
            </div>
            <BookOpen className="size-6 text-teal-200" aria-hidden />
          </div>
        </article>

        <article className="rounded-md border border-white/10 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">AI Tutor</p>
              <Badge
                variant="outline"
                className="mt-3 border-amber-300/30 text-amber-200"
              >
                Chat not connected
              </Badge>
            </div>
            <MessageSquareText className="size-6 text-teal-200" aria-hidden />
          </div>
        </article>
      </section>
    </div>
  )
}
