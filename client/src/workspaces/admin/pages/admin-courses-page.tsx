import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminCoursesTable } from '@/workspaces/admin/components/admin-courses-table'
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import { CreateAdminCourseDialog } from '@/workspaces/admin/components/course-dialogs'
import {
  useCourseAdministrationMutations,
  useCourseAdministration,
} from '@/features/courses/use-course-administration'

export function AdminCoursesPage() {
  const coursesQuery = useCourseAdministration()
  const courseMutations = useCourseAdministrationMutations()

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Course Operations"
        title="Course Management"
        description="Create courses, review course ownership, membership, and learning-material counts."
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          actions={
            <CreateAdminCourseDialog
              onCreateCourse={(values) =>
                courseMutations.createCourse.mutateAsync(values)
              }
            />
          }
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
          <AdminCoursesTable
            courses={coursesQuery.data ?? []}
            onUpdateCourse={(id, input) =>
              courseMutations.updateCourse.mutateAsync({ id, input })
            }
          />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
