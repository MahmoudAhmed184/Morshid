import { EyeIcon, FileTextIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/custom/page-header'
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
import { AdminPanel } from '../components/admin-panel'
import { AdminStatusBadge } from '../components/admin-status-badge'
import { EditAdminMaterialDialog } from '../components/edit-admin-material-dialog'
import {
  useAdminCourseMaterials,
  useAdminCourseMutations,
  useAdminCourses,
} from '../hooks/use-admin-courses'
import type { AdminCourseMaterial } from '../schemas/admin-course-material.schema'

const materialDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function AdminMaterialsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedMaterial, setSelectedMaterial] =
    useState<AdminCourseMaterial | null>(null)
  const coursesQuery = useAdminCourses()
  const courseId = selectedCourseId || coursesQuery.data?.[0]?.id
  const materialsQuery = useAdminCourseMaterials(courseId)
  const { editMaterial } = useAdminCourseMutations(courseId)
  const selectedCourse = coursesQuery.data?.find(
    (course) => course.id === courseId,
  )
  const courseSelectItems = useMemo(
    () =>
      coursesQuery.data?.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })) ?? [],
    [coursesQuery.data],
  )
  const isLoading =
    coursesQuery.isPending ||
    (courseId !== undefined && materialsQuery.isPending)
  const isError = coursesQuery.isError || materialsQuery.isError

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Content Operations"
        title="Material Metadata"
        description="Review material titles, owners, asset type, course association, and publication state."
      />

      <AdminPanel>
        <DataToolbar
          className="border-b px-4 py-3"
          filters={
            <Select
              value={courseId ?? null}
              onValueChange={(value) => setSelectedCourseId(value ?? '')}
              items={courseSelectItems}
            >
              <SelectTrigger
                className="h-9 px-3 text-xs rounded-lg border-border/80 w-full sm:w-80 max-w-full"
                aria-label="Course"
              >
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {courseSelectItems.map((course) => (
                  <SelectItem
                    key={course.value}
                    value={course.value}
                    className="text-xs py-1.5"
                  >
                    {course.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <DataTableState
          isLoading={isLoading}
          isError={isError}
          isEmpty={
            coursesQuery.data?.length === 0 || materialsQuery.data?.length === 0
          }
          onRetry={() =>
            void Promise.all([coursesQuery.refetch(), materialsQuery.refetch()])
          }
          isRetrying={coursesQuery.isFetching || materialsQuery.isFetching}
          emptyTitle="No materials found"
          emptyDescription="No material metadata is available for this course."
        >
          {/* Mobile Compact List (< md) — No Horizontal Scroll */}
          <div className="divide-y divide-border md:hidden">
            {materialsQuery.data?.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between p-3.5 gap-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-semibold text-foreground truncate text-sm">
                    {material.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate font-mono">
                    {material.originalFilename}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <AdminStatusBadge status={material.status} />
                    <span>•</span>
                    <span>{material.uploadedBy.displayName}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSelectedMaterial(material)}
                    aria-label="View material details"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <EyeIcon className="size-4" />
                  </Button>
                  <EditAdminMaterialDialog
                    material={material}
                    isPending={editMaterial.isPending}
                    onSave={(title) =>
                      editMaterial.mutateAsync({
                        materialId: material.id,
                        title,
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block w-full max-h-[65vh] overflow-x-auto overflow-y-auto scrollbar-themed">
            <Table className="w-full min-w-[820px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow>
                  {[
                    'Material',
                    'Course',
                    'Type',
                    'Status',
                    'Owner',
                    'Updated',
                    'Actions',
                  ].map((header) => (
                    <TableHead
                      key={header}
                      className="smallcaps-label h-11 px-4 first:pl-6 last:pr-6"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialsQuery.data?.map((material) => (
                  <TableRow
                    key={material.id}
                    className="h-[52px] hover:bg-secondary/40"
                  >
                    <TableCell className="px-4 py-3.5 first:pl-6 min-w-0">
                      <p className="font-medium text-foreground truncate max-w-[200px]">
                        {material.title}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                        {material.id}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 min-w-0">
                      <p className="truncate max-w-[120px]">
                        {selectedCourse?.code ?? material.courseId}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 min-w-0">
                      <p>PDF</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {material.originalFilename}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <AdminStatusBadge status={material.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3.5 min-w-0">
                      <p className="truncate max-w-[140px]">
                        {material.uploadedBy.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {material.uploadedBy.email}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums whitespace-nowrap">
                      {materialDateFormatter.format(
                        new Date(material.updatedAt),
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 last:pr-6">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSelectedMaterial(material)}
                          aria-label="View material details"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <EyeIcon className="size-4" />
                        </Button>
                        <EditAdminMaterialDialog
                          material={material}
                          isPending={editMaterial.isPending}
                          onSave={(title) =>
                            editMaterial.mutateAsync({
                              materialId: material.id,
                              title,
                            })
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataTableState>
      </AdminPanel>

      <Dialog
        open={Boolean(selectedMaterial)}
        onOpenChange={(open) => !open && setSelectedMaterial(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileTextIcon className="size-5 text-primary" />
              Material Details
            </DialogTitle>
          </DialogHeader>

          {selectedMaterial ? (
            <div className="grid gap-3.5 py-1 text-sm">
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Title & Filename
                </p>
                <p className="font-semibold text-foreground text-base">
                  {selectedMaterial.title}
                </p>
                <p className="font-mono text-xs text-muted-foreground select-all">
                  {selectedMaterial.originalFilename}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </p>
                  <div>
                    <AdminStatusBadge status={selectedMaterial.status} />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Course Code
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedCourse?.code ?? selectedMaterial.courseId}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Uploaded By
                </p>
                <p className="font-medium text-foreground">
                  {selectedMaterial.uploadedBy.displayName}
                </p>
                <p className="text-xs text-muted-foreground select-all">
                  {selectedMaterial.uploadedBy.email}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Material ID
                </p>
                <p className="font-mono text-xs text-foreground select-all break-all">
                  {selectedMaterial.id}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Last Updated
                </p>
                <p className="font-medium text-foreground">
                  {materialDateFormatter.format(
                    new Date(selectedMaterial.updatedAt),
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
