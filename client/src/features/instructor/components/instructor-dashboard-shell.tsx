import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import { InstructorDashboardPage } from '@/features/instructor/pages/instructor-dashboard-page'

const p0CourseCode = 'PYTHON-PROG-P0'

export function InstructorDashboardShell() {
  const coursesQuery = useInstructorCourses()

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
