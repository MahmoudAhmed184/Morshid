import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import { PageHeader } from '@/components/ui/custom/page-header'
import { NumberedPagination } from '@/components/ui/custom/pagination'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { AdminCoursesTable } from '@/workspaces/admin/components/admin-courses-table'
import { AdminPanel } from '@/workspaces/admin/components/admin-panel'
import { CreateAdminCourseDialog } from '@/workspaces/admin/components/course-dialogs'
import {
  useCourseAdministrationMutations,
  useCourseAdministrationPages,
} from '@/workspaces/admin/use-course-administration'

export function AdminCoursesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const coursesQuery = useCourseAdministrationPages(debouncedSearch)
  const [page, setPage] = useState(1)
  const courseMutations = useCourseAdministrationMutations()
  const pages = coursesQuery.data?.pages ?? []
  const totalCount = pages.at(-1)?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / 10))
  const courses = pages[page - 1]?.courses ?? []

  useEffect(() => {
    if (
      page > pages.length &&
      coursesQuery.hasNextPage &&
      !coursesQuery.isFetchingNextPage
    ) {
      void coursesQuery.fetchNextPage()
    }
  }, [page, pages.length, coursesQuery])

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
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
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
          isLoading={coursesQuery.isPending || page > pages.length}
          isError={coursesQuery.isError}
          isEmpty={courses.length === 0}
          onRetry={() => void coursesQuery.refetch()}
          isRetrying={coursesQuery.isFetching}
          emptyTitle={
            debouncedSearch ? 'No matching courses' : 'No courses found'
          }
          emptyDescription={
            debouncedSearch
              ? `No courses match "${search.trim()}".`
              : 'Courses returned by the API will appear here.'
          }
        >
          <AdminCoursesTable
            courses={courses}
            onUpdateCourse={(id, input) =>
              courseMutations.updateCourse.mutateAsync({ id, input })
            }
            onDeleteCourse={(id) =>
              courseMutations.deleteCourse.mutateAsync(id)
            }
          />
          {totalCount > 0 ? (
            <div className="border-t px-4 py-3">
              <NumberedPagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                limit={10}
                itemName="courses"
                disabled={coursesQuery.isFetchingNextPage}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
