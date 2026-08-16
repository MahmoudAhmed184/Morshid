import { useState } from 'react'

import { useCourseMembership } from '@/workspaces/instructor/use-course-membership'
import { useInstructorReviewWorkloadSummary } from '@/workspaces/instructor/reviews/use-reviews'
import { InstructorDashboardPage } from '@/workspaces/instructor/dashboard/instructor-dashboard-page'

export function InstructorDashboardShell() {
  const coursesQuery = useCourseMembership()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  const selectedCourse = coursesQuery.data?.find(
    (candidate) => candidate.id === selectedCourseId,
  )
  const courseId = selectedCourse
    ? selectedCourse.id
    : coursesQuery.data?.[0]?.id

  const workloadQuery = useInstructorReviewWorkloadSummary(courseId)

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
        reviewQueueCount: workloadQuery.data?.pendingCount,
        workloadSummary: workloadQuery.data,
      }}
    />
  )
}
