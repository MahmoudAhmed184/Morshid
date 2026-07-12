import { DataTableState } from '@/components/ui/custom/data-table-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { CourseList } from '@/features/course/components/course-list'
import { useCourses } from '@/features/course/hooks/use-course'

export function AdminCoursesPage() {
  const coursesQuery = useCourses()

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Course Operations"
        title="Course Management"
        description="Review course ownership, membership, and learning-material counts."
      />

      <DataTableState
        isLoading={coursesQuery.isPending}
        isError={coursesQuery.isError}
        isEmpty={coursesQuery.data?.length === 0}
        onRetry={() => void coursesQuery.refetch()}
        isRetrying={coursesQuery.isFetching}
        emptyTitle="No courses found"
        emptyDescription="Courses returned by the API will appear here."
      >
        <CourseList courses={coursesQuery.data ?? []} viewerRole="ADMIN" />
      </DataTableState>
    </div>
  )
}
