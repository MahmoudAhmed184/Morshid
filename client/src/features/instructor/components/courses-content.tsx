import { ErrorState } from '@/components/ui/custom/error-state'
import {
  CourseHero,
  CourseHeroSkeleton,
} from '@/features/instructor/components/course-hero'
import { NoCourseState } from '@/features/instructor/components/no-course-state'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'

const courseSkeletonKeys = ['course-1', 'course-2', 'course-3'] as const

type CoursesContentProps = {
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  isRetrying: boolean
  onRetry: () => void
  courses: InstructorCourse[]
}

export function CoursesContent({
  isLoading,
  isError,
  isEmpty,
  isRetrying,
  onRetry,
  courses,
}: CoursesContentProps) {
  if (isLoading) {
    return (
      <div
        aria-label="Loading assigned courses"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        role="status"
      >
        {courseSkeletonKeys.map((key) => (
          <CourseHeroSkeleton key={key} />
        ))}
      </div>
    )
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <CourseHero key={course.id} course={course} />
      ))}
    </div>
  )
}
