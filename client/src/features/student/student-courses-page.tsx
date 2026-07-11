import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/stores/auth.store'

export function StudentCoursesPage() {
  const user = useAuthStore((state) => state.user)
  const assignedCourses =
    user?.courses.filter((course) => course.membershipRole === 'STUDENT') ?? []

  return (
    <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
      <div className="mb-5">
        <p className="text-sm text-zinc-400">Student Workspace</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Courses
        </h1>
      </div>

      {assignedCourses.length > 0 ? (
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Assigned courses"
        >
          {assignedCourses.map((course) => (
            <article
              key={course.id}
              className="rounded-md border border-white/10 bg-zinc-950/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-white">
                    {course.title}
                  </h2>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {course.code}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-teal-400/30 text-teal-200"
                >
                  Assigned
                </Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Course workspace placeholder. Materials and sessions will be
                connected in later sprint work.
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-md border border-dashed border-white/10 bg-zinc-950/40 p-6 text-sm text-zinc-400">
          No courses assigned yet.
        </section>
      )}
    </div>
  )
}
