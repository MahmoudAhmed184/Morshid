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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InstructorListSkeleton } from '@/features/instructor/components/instructor-list-skeleton'
import {
  getInstructorMaterialStatusMessage,
  InstructorMaterialCard,
  InstructorMaterialStatusBadge,
} from '@/features/instructor/components/instructor-material-card'
import { MaterialUploadDialog } from '@/features/instructor/components/material-upload-dialog'
import { summarizeInstructorMaterials } from '@/features/instructor/domain/summarize-instructor-materials'
import { useInstructorCourses } from '@/features/instructor/hooks/use-instructor-courses'
import {
  useInstructorMaterials,
  useInstructorMaterialUploadConfiguration,
} from '@/features/instructor/hooks/use-instructor-materials'
import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

const materialDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

const materialTableHeaders = [
  'Material name',
  'Updated',
  'Status',
  'Extracted text',
  'Chunks',
] as const

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course Materials"
        description="Manage and upload course PDF sources for your students."
        actions={
          activeCourseId && uploadConfigurationQuery.data ? (
            <MaterialUploadDialog
              courseId={activeCourseId}
              configuration={uploadConfigurationQuery.data}
            />
          ) : activeCourseId ? (
            <Button disabled variant="outline">
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

      <Card
        className="rounded-[8px] py-0 ring-1 ring-foreground/10"
        aria-busy={isLoading || undefined}
      >
        <CardHeader className="border-b border-border px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-sm">Material repository</CardTitle>
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
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="status"
      >
        {['total', 'processing', 'ready', 'attention'].map((key) => (
          <Card
            key={key}
            aria-hidden
            className="rounded-[8px] [--card-spacing:--spacing(3)]"
          >
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
        <Card className="rounded-[8px] [--card-spacing:--spacing(3)]">
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
    },
    {
      label: 'Processing',
      value: summary.processing,
      description:
        summary.processing === 0
          ? 'All documents settled'
          : 'Preparing sources',
      icon: <LoaderCircleIcon aria-hidden />,
    },
    {
      label: 'Ready',
      value: summary.ready,
      description: 'Available course sources',
      icon: <CircleCheckIcon aria-hidden />,
    },
    {
      label: 'Needs attention',
      value: summary.attention,
      description: 'Warnings and failures',
      icon: <TriangleAlertIcon aria-hidden />,
    },
  ]

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Material summary"
    >
      {summaryItems.map((item) => (
        <StatCard
          key={item.label}
          {...item}
          className="rounded-[8px] [--card-spacing:--spacing(3)]"
        />
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
        className="m-4 min-h-44 rounded-[8px]"
      />
    )
  }

  if (!hasCourse) {
    return (
      <EmptyState
        icon={<FileTextIcon aria-hidden />}
        title="No assigned course"
        description="Assign a course before this workspace can show course materials."
        className="m-4 min-h-44 rounded-[8px]"
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
        className="m-4 min-h-44 rounded-[8px]"
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
      <div className="hidden md:block">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {materialTableHeaders.map((header) => (
                <TableHead
                  key={header}
                  className="h-11 px-4 text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <InstructorMaterialRow key={material.id} material={material} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {materials.map((material) => (
          <InstructorMaterialCard key={material.id} material={material} />
        ))}
      </div>
    </>
  )
}

function InstructorMaterialRow({ material }: { material: InstructorMaterial }) {
  const statusMessage = getInstructorMaterialStatusMessage(material)

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="max-w-80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-muted text-primary">
            <FileTextIcon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {material.title}
            </p>
            <p className="break-all text-xs whitespace-normal text-muted-foreground">
              {material.originalFilename}
            </p>
            {statusMessage ? (
              <p className="mt-1 break-words text-xs whitespace-normal text-muted-foreground">
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {materialDateFormatter.format(new Date(material.updatedAt))}
      </TableCell>
      <TableCell className="px-4 py-3">
        <InstructorMaterialStatusBadge status={material.status} />
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {material.extractedTextLength?.toLocaleString() ?? '—'}
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {material.chunkCount?.toLocaleString() ?? '—'}
      </TableCell>
    </TableRow>
  )
}
