import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { PageHeader } from '@/components/ui/custom/page-header'
import { LoadMoreButton } from '@/components/ui/custom/load-more-button'
import { useState } from 'react'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { AdminCoursesTable } from '@/workspaces/admin/components/admin-courses-table'
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import { CreateAdminCourseDialog } from '@/workspaces/admin/components/course-dialogs'
import {
  useCourseAdministrationMutations,
  useCourseAdministration,
} from '@/workspaces/admin/use-course-administration'

export function AdminCoursesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const coursesQuery = useCourseAdministration(debouncedSearch)
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
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search courses by code or title..."
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
            onDeleteCourse={(id) =>
              courseMutations.deleteCourse.mutateAsync(id)
            }
          />
          <LoadMoreButton
            hasNextPage={coursesQuery.hasNextPage}
            isFetchingNextPage={coursesQuery.isFetchingNextPage}
            onLoadMore={() => void coursesQuery.fetchNextPage()}
            label="Load more courses"
          />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
