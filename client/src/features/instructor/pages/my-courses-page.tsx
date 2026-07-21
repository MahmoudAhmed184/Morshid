import { PageHeader } from '@/components/ui/custom/page-header'
import { CoursesContent } from '@/features/instructor/components/courses-content'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

export function MyCoursesPage() {
  const coursesQuery = useInstructorCourses()
  const isLoading = coursesQuery.isPending
  const isError = coursesQuery.isError
  const isEmpty = coursesQuery.isSuccess && coursesQuery.data.length === 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Instructor workspace"
        title="My Courses"
        description="View your assigned courses and workspace activity."
      />

      <CoursesContent
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        isRetrying={coursesQuery.isFetching}
        onRetry={() => {
          void coursesQuery.refetch()
        }}
        courses={coursesQuery.data ?? []}
      />
    </div>
  )
}
