import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { instructorCoursesQueryOptions } from '@/features/instructor-dashboard/instructor-dashboard.api'
import { InstructorDashboardPage } from '@/features/instructor-dashboard/instructor-dashboard-page'

const p0CourseCode = 'PYTHON-PROG-P0'

export function InstructorDashboardShell() {
  const userId = useAuthStore((state) => state.user?.id)
  const coursesQuery = useQuery(instructorCoursesQueryOptions(userId))

  if (coursesQuery.isPending) {
    return <InstructorDashboardPage state={{ status: 'loading' }} />
  }

  if (coursesQuery.isError) {
    throw coursesQuery.error
  }

  const course = coursesQuery.data.find(
    (candidate) => candidate.code === p0CourseCode,
  )

  return (
    <InstructorDashboardPage
      state={
        course
          ? {
              status: 'ready',
              course: { code: course.code, title: course.title },
              materialCount: 0,
              reviewQueueCount: 0,
            }
          : { status: 'empty' }
      }
    />
  )
}
