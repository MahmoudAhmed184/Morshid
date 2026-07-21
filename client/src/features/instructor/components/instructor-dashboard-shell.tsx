import { useState } from 'react'

import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import { InstructorDashboardPage } from '@/features/instructor/pages/instructor-dashboard-page'

const p0CourseCode = 'PYTHON-PROG-P0'

export function InstructorDashboardShell() {
  const coursesQuery = useInstructorCourses()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  if (coursesQuery.isPending) {
    return <InstructorDashboardPage state={{ status: 'loading' }} />
  }

  if (coursesQuery.isError) {
    return (
      <InstructorDashboardPage
        state={{
          status: 'error',
          onRetry: () => {
            void coursesQuery.refetch()
          },
          isRetrying: coursesQuery.isFetching,
        }}
      />
    )
  }

  const courses = coursesQuery.data

  if (courses.length === 0) {
    return <InstructorDashboardPage state={{ status: 'empty' }} />
  }

  // Prefer an explicit switcher selection, then the seeded P0 course, then the
  // first owned course. In current data there is exactly one course.
  const course =
    courses.find((candidate) => candidate.id === selectedCourseId) ??
    courses.find((candidate) => candidate.code === p0CourseCode) ??
    courses[0]

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        course,
        courses,
        onSelectCourse: setSelectedCourseId,
        materialCount: 0,
        reviewQueueCount: 0,
      }}
    />
  )
}
