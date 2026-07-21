import { FileText, Search, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
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
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Instructor workspace"
        title="Materials"
        description="Shell view for course source readiness. Upload and ingestion are deferred."
        actions={
          <Button size="lg" disabled type="button">
            <Upload aria-hidden />
            Upload material
          </Button>
        }
      />

      <section aria-busy={isLoading || undefined}>
        <Card className="py-0">
          <CardHeader className="border-b px-4 py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <FileText
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Course Materials
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-9 min-w-44 items-center rounded-xl bg-secondary/60 px-4 text-xs text-muted-foreground">
                  <Search className="mr-2 size-3.5" aria-hidden />
                  Search by title
                </div>
                <div className="flex h-9 items-center gap-1.5 rounded-xl bg-secondary/60 px-4 text-xs text-muted-foreground">
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
        className="min-h-44"
      />
    )
  }

  if (!hasCourse) {
    return (
      <EmptyState
        icon={<FileText aria-hidden />}
        title="No assigned course"
        description="Assign a course before this workspace can show course materials."
        className="min-h-44"
      />
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
