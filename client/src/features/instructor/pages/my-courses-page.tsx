import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/custom/page-header'
import { CoursesContent } from '@/features/instructor/components/courses-content'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

export function MyCoursesPage() {
  const coursesQuery = useInstructorCourses()
  const isLoading = coursesQuery.isPending
  const isError = coursesQuery.isError
  const isEmpty = coursesQuery.isSuccess && coursesQuery.data.length === 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
        title="My Courses"
        description="View and manage every course assigned to your Instructor account."
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
