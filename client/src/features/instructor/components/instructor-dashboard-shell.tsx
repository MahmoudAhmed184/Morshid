import { useState } from 'react'

import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import { InstructorDashboardPage } from '@/features/instructor/pages/instructor-dashboard-page'

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

  const course =
    courses.find((candidate) => candidate.id === selectedCourseId) ?? courses[0]

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        course,
        courses,
        onSelectCourse: setSelectedCourseId,
      }}
    />
  )
}
