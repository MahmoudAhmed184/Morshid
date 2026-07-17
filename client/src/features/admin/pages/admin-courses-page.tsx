import { DataTableState } from '@/components/ui/custom/data-table-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminCoursesTable } from '@/features/admin/components/admin-courses-table'
import { AdminPanel } from '@/features/admin/components/admin-panel'
import { useAdminCourses } from '@/features/admin/hooks/use-admin-courses'

export function AdminCoursesPage() {
  const coursesQuery = useAdminCourses()

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Course Operations"
        title="Course Management"
        description="Review course ownership, membership, and learning-material counts."
      />

      <AdminPanel>
        <DataTableState
          isLoading={coursesQuery.isPending}
          isError={coursesQuery.isError}
          isEmpty={coursesQuery.data?.length === 0}
          onRetry={() => void coursesQuery.refetch()}
          isRetrying={coursesQuery.isFetching}
          emptyTitle="No courses found"
          emptyDescription="Courses returned by the API will appear here."
        >
          <AdminCoursesTable courses={coursesQuery.data ?? []} />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
