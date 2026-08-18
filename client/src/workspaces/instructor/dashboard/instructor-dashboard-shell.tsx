import { useState } from 'react'

import { useCourseMembership } from '@/workspaces/instructor/use-course-membership'
import { useCourseMaterials } from '@/workspaces/instructor/materials/use-materials'
import { useInstructorReviewWorkloadSummary } from '@/workspaces/instructor/reviews/use-reviews'
import { InstructorDashboardPage } from '@/workspaces/instructor/dashboard/instructor-dashboard-page'
import { useInstructorWorkspacePreferences } from '@/workspaces/instructor/preferences/use-instructor-workspace-preferences'

export function InstructorDashboardShell() {
  const coursesQuery = useCourseMembership()
  const { setActiveCourseId, resolveActiveCourse } =
    useInstructorWorkspacePreferences()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  const selectedCourse = coursesQuery.data?.find(
    (candidate) => candidate.id === selectedCourseId,
  )
  const courseId = selectedCourse
    ? selectedCourse.id
    : coursesQuery.data?.[0]?.id

  const workloadQuery = useInstructorReviewWorkloadSummary(courseId)
  const materialsQuery = useCourseMaterials(courseId)

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
    selectedCourseId !== null
      ? (courses.find((candidate) => candidate.id === selectedCourseId) ??
        resolveActiveCourse(courses) ??
        courses[0])
      : (resolveActiveCourse(courses) ?? courses[0])

  const handleSelectCourse = (nextCourseId: string | null) => {
    setSelectedCourseId(nextCourseId)
    setActiveCourseId(nextCourseId)
  }

  const materialCount = materialsQuery.data?.pages[0]?.total

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        course,
        courses,
        onSelectCourse: handleSelectCourse,
        materialCount,
        reviewQueueCount: workloadQuery.data?.pendingCount,
        workloadSummary: workloadQuery.data,
      }}
    />
  )
}
