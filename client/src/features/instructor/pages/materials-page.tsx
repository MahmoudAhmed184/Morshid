import {
  CircleCheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { SearchInput } from '@/components/ui/custom/search-input'
import { StatCard } from '@/components/ui/custom/stat-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import { InstructorMaterialCard } from '@/features/instructor/components/instructor-material-card'
import { MaterialUploadDialog } from '@/features/instructor/components/material-upload-dialog'
import { summarizeInstructorMaterials } from '@/features/instructor/domain/summarize-instructor-materials'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import {
  useInstructorMaterials,
  useInstructorMaterialUploadConfiguration,
} from '@/features/instructor/hooks/use-instructor-materials'
import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

export function MaterialsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>()
  const [search, setSearch] = useState('')
  const coursesQuery = useInstructorCourses()
  const uploadConfigurationQuery = useInstructorMaterialUploadConfiguration()
  const courses = coursesQuery.data ?? []
  const courseSelectItems = courses.map((course) => ({
    label: `${course.code} — ${course.title}`,
    value: course.id,
  }))
  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? courses.at(0)
  const activeCourseId = selectedCourse?.id
  const materialsQuery = useInstructorMaterials(activeCourseId)
  const materials = materialsQuery.data ?? []
  const normalizedSearch = search.trim().toLowerCase()
  const filteredMaterials = normalizedSearch
    ? materials.filter(
        (material) =>
          material.title.toLowerCase().includes(normalizedSearch) ||
          material.originalFilename.toLowerCase().includes(normalizedSearch),
      )
    : materials
  const hasColdMaterialsError =
    materialsQuery.isError && materialsQuery.data === undefined
  const isLoading =
    coursesQuery.isPending ||
    (activeCourseId !== undefined && materialsQuery.isPending)
  const isError = coursesQuery.isError || hasColdMaterialsError

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="COURSE SOURCES"
        title="Course Materials"
        description="Upload and manage the PDF sources that ground student guidance."
        actions={
          activeCourseId && uploadConfigurationQuery.data ? (
            <MaterialUploadDialog
              courseId={activeCourseId}
              configuration={uploadConfigurationQuery.data}
            />
          ) : activeCourseId ? (
            <Button size="lg" disabled>
              {uploadConfigurationQuery.isError
                ? 'Upload unavailable'
                : 'Loading upload limits...'}
            </Button>
          ) : null
        }
      />

      {activeCourseId && !coursesQuery.isPending ? (
        <MaterialSummarySection
          courseCode={selectedCourse.code}
          isPending={materialsQuery.isPending}
          isError={hasColdMaterialsError}
          materials={materialsQuery.data}
        />
      ) : null}

      <Card className="py-0" aria-busy={isLoading || undefined}>
        <CardHeader className="border-b px-4 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileTextIcon
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              Material repository
            </CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search by title or file..."
                aria-label="Search materials"
                className="sm:max-w-64"
              />
              {courses.length > 0 ? (
                <Select
                  value={activeCourseId}
                  items={courseSelectItems}
                  onValueChange={(value) => {
                    setSelectedCourseId(value ?? undefined)
                    setSearch('')
                  }}
                >
                  <SelectTrigger
                    className="w-full sm:w-64"
                    aria-label="Select assigned course"
                  >
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {courseSelectItems.map((course) => (
                      <SelectItem key={course.value} value={course.value}>
                        {course.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <MaterialsContent
            isLoading={isLoading}
            isError={isError}
            hasCourse={activeCourseId !== undefined}
            materials={filteredMaterials}
            hasSearch={normalizedSearch.length > 0}
            isRetrying={coursesQuery.isFetching || materialsQuery.isFetching}
            hasRefreshError={
              materialsQuery.data !== undefined && materialsQuery.isRefetchError
            }
            onRetry={() => {
              if (coursesQuery.isError) {
                void coursesQuery.refetch()
                return
              }

              void materialsQuery.refetch()
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function MaterialSummarySection({
  courseCode,
  isPending,
  isError,
  materials,
}: {
  courseCode: string
  isPending: boolean
  isError: boolean
  materials: InstructorMaterial[] | undefined
}) {
  if (isPending && materials === undefined) {
    return (
      <section
        aria-label="Loading material summary"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        role="status"
      >
        {['total', 'processing', 'ready', 'attention'].map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
              <Skeleton className="mt-2 h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>
    )
  }

  if (isError || materials === undefined) {
    return (
      <section aria-label="Material summary" role="status">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Material summary unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Retry the materials request to load current totals.
          </CardContent>
        </Card>
      </section>
    )
  }

  const summary = summarizeInstructorMaterials(materials)
  const summaryItems = [
    {
      label: 'Total materials',
      value: summary.total,
      description: courseCode,
      icon: <FileTextIcon aria-hidden />,
      tone: 'primary' as const,
    },
    {
      label: 'Processing',
      value: summary.processing,
      description:
        summary.processing === 0
          ? 'All documents settled'
          : 'Preparing sources',
      icon: <LoaderCircleIcon aria-hidden />,
      tone: 'info' as const,
    },
    {
      label: 'Ready',
      value: summary.ready,
      description: 'Available course sources',
      icon: <CircleCheckIcon aria-hidden />,
      tone: 'success' as const,
    },
    {
      label: 'Needs attention',
      value: summary.attention,
      description: 'Warnings and failures',
      icon: <TriangleAlertIcon aria-hidden />,
      tone: 'warning' as const,
    },
  ]

  return (
    <section
      className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Material summary"
    >
      {summaryItems.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </section>
  )
}

function MaterialsContent({
  isLoading,
  isError,
  hasCourse,
  materials,
  hasSearch,
  isRetrying,
  hasRefreshError,
  onRetry,
}: {
  isLoading: boolean
  isError: boolean
  hasCourse: boolean
  materials: InstructorMaterial[]
  hasSearch: boolean
  isRetrying: boolean
  hasRefreshError: boolean
  onRetry: () => void
}) {
  if (isLoading) {
    return (
      <div className="p-4">
        <InstructorListSkeleton aria-label="Loading materials" rows={5} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load materials"
        description="Course materials could not be loaded. Try again."
        onRetry={onRetry}
        isRetrying={isRetrying}
        className="m-4 min-h-44"
      />
    )
  }

  if (!hasCourse) {
    return (
      <EmptyState
        icon={<FileTextIcon aria-hidden />}
        title="No assigned course"
        description="Assign a course before this workspace can show course materials."
        className="m-4 min-h-44"
      />
    )
  }

  if (materials.length === 0) {
    return (
      <EmptyState
        icon={<FileTextIcon aria-hidden />}
        title={hasSearch ? 'No matching materials' : 'No materials yet'}
        description={
          hasSearch
            ? 'Try a different material title or filename.'
            : 'Upload a clean, text-based PDF to prepare the first course source.'
        }
        className="m-4 min-h-44"
      />
    )
  }

  return (
    <>
      {hasRefreshError ? (
        <Alert className="m-4 mb-0">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>Processing status refresh failed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            Previously loaded materials are shown. Retry to refresh their
            current status.
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRetrying}
              onClick={onRetry}
            >
              Retry status refresh
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {materials.map((material) => (
          <InstructorMaterialCard key={material.id} material={material} />
        ))}
      </div>
    </>
  )
}
