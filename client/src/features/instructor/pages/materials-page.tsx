import { FileText, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import { InstructorSectionHeader } from '@/features/instructor/components/instructor-section-header'
import { PdfCard } from '@/features/instructor/components/pdf-card'
import { placeholderPdfMaterials } from '@/features/instructor/constants/instructor-dashboard.constants'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'

export function MaterialsPage() {
  const coursesQuery = useInstructorCourses()
  const isLoading = coursesQuery.isPending
  const isError = coursesQuery.isError
  const hasCourse =
    coursesQuery.isSuccess &&
    coursesQuery.data.some((course) => course.code === 'PYTHON-PROG-P0')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FileText className="size-4 text-primary" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Materials
        </h1>
      </div>

      <section className="space-y-3" aria-busy={isLoading || undefined}>
        <InstructorSectionHeader
          title="Materials"
          description="Shell view for course source readiness. Upload and ingestion are deferred."
        />
        <Card className="rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="size-4 text-primary" aria-hidden />
                Course Materials
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-8 min-w-44 items-center rounded-[6px] border border-border bg-background px-3 text-xs text-muted-foreground">
                  <Search className="mr-2 size-3.5" aria-hidden />
                  Search by title
                </div>
                <div className="flex h-8 items-center rounded-[6px] border border-border px-3 text-xs text-muted-foreground">
                  All Topics
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <MaterialsListContent
              isLoading={isLoading}
              isError={isError}
              hasCourse={hasCourse}
              isRetrying={coursesQuery.isFetching}
              onRetry={() => {
                void coursesQuery.refetch()
              }}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function MaterialsListContent({
  isLoading,
  isError,
  hasCourse,
  isRetrying,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  hasCourse: boolean
  isRetrying: boolean
  onRetry: () => void
}) {
  if (isLoading) {
    return <InstructorListSkeleton aria-label="Loading materials" />
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load materials"
        description="Course context could not be loaded for materials. Try again."
        onRetry={onRetry}
        isRetrying={isRetrying}
        className="min-h-44 rounded-[8px]"
      />
    )
  }

  if (!hasCourse) {
    return (
      <EmptyState
        icon={<FileText aria-hidden />}
        title="No assigned course"
        description="Assign a course before this workspace can show course materials."
        className="min-h-44 rounded-[8px]"
      />
    )
  }

  return (
    <div className="space-y-3">
      {placeholderPdfMaterials.map((material) => (
        <PdfCard
          key={material.id}
          title={material.title}
          description={material.description}
          status={material.status}
          actions={
            <>
              <DropdownMenuItem disabled>Preview</DropdownMenuItem>
              <DropdownMenuItem disabled>Download</DropdownMenuItem>
            </>
          }
        />
      ))}
    </div>
  )
}
