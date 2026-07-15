import { BookOpen } from 'lucide-react'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { CourseHero } from '@/features/instructor/components/course-hero'
import { NoCourseState } from '@/features/instructor/components/no-course-state'

export function MyCoursesPage() {
  const user = useAuthStore((state) => state.user)
  const courses = user?.courses ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <BookOpen className="size-4 text-primary" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          My Courses
        </h1>
      </div>

      {courses.length === 0 ? (
        <NoCourseState />
      ) : (
        <div className="flex flex-col gap-5">
          {courses.map((course) => (
            <CourseHero key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
