import { useState } from 'react'

import { useCourseMembership } from '@/workspaces/instructor/use-course-membership'
import { InstructorDashboardPage } from '@/workspaces/instructor/dashboard/instructor-dashboard-page'
import { useInstructorWorkspacePreferences } from '@/workspaces/instructor/preferences/use-instructor-workspace-preferences'

export function InstructorDashboardShell() {
  const coursesQuery = useCourseMembership()
  const { setActiveCourseId, resolveActiveCourse } =
    useInstructorWorkspacePreferences()
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
    selectedCourseId !== null
      ? (courses.find((candidate) => candidate.id === selectedCourseId) ??
        resolveActiveCourse(courses) ??
        courses[0])
      : (resolveActiveCourse(courses) ?? courses[0])

  const handleSelectCourse = (courseId: string | null) => {
    setSelectedCourseId(courseId)
    setActiveCourseId(courseId)
  }

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        course,
        courses,
        onSelectCourse: handleSelectCourse,
      }}
    />
  )
}
