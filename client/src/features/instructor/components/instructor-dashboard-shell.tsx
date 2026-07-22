import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import { InstructorDashboardPage } from '@/features/instructor/pages/instructor-dashboard-page'

export function InstructorDashboardShell() {
  const coursesQuery = useInstructorCourses()
  const courses = coursesQuery.data ?? []

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

  if (courses.length === 0) {
    return <InstructorDashboardPage state={{ status: 'empty' }} />
  }

  return (
    <InstructorDashboardPage
      state={{
        status: 'ready',
        courses,
      }}
    />
  )
}
