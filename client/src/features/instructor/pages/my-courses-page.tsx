import { BookOpen } from 'lucide-react'

import { ErrorState } from '@/components/ui/custom/error-state'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthCourseSummary } from '@/features/auth/types/auth.types'
import {
  CourseHero,
  CourseHeroSkeleton,
} from '@/features/instructor/components/course-hero'
import { NoCourseState } from '@/features/instructor/components/no-course-state'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

export function MyCoursesPage() {
  const user = useAuthStore((state) => state.user)
  const coursesQuery = useInstructorCourses()
  const authCourses = user?.courses ?? []

  const showAuthCourses = authCourses.length > 0
  const isLoading = coursesQuery.isPending && !showAuthCourses
  const isError = coursesQuery.isError && !showAuthCourses
  const isEmpty =
    !isLoading &&
    !isError &&
    (coursesQuery.isSuccess
      ? coursesQuery.data.length === 0
      : authCourses.length === 0)

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

      <CoursesContent
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        isRetrying={coursesQuery.isFetching}
        onRetry={() => {
          void coursesQuery.refetch()
        }}
        courses={authCourses}
      />
    </div>
  )
}

function CoursesContent({
  isLoading,
  isError,
  isEmpty,
  isRetrying,
  onRetry,
  courses,
}: {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  isRetrying: boolean
  onRetry: () => void
  courses: AuthCourseSummary[]
}) {
  if (isLoading) {
    return <CourseHeroSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load courses"
        description="Your assigned courses could not be loaded. Try again."
        onRetry={onRetry}
        isRetrying={isRetrying}
        className="min-h-56 rounded-[8px]"
      />
    )
  }

  if (isEmpty) {
    return <NoCourseState />
  }

  return (
    <div className="flex flex-col gap-5">
      {courses.map((course) => (
        <CourseHero key={course.id} course={course} />
      ))}
    </div>
  )
}
