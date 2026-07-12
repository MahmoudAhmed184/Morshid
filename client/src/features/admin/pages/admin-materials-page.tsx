import { useMemo, useState } from 'react'

import { DataTableState } from '@/components/ui/custom/data-table-state'
import { DataToolbar } from '@/components/ui/custom/data-toolbar'
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

const materialDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function AdminMaterialsPage() {
  const [selectedCourseId, setSelectedCourseId] = useState('')
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
          className="border-b p-4"
          filters={
            <Select
              value={courseId ?? null}
              onValueChange={(value) => setSelectedCourseId(value ?? '')}
              items={courseSelectItems}
            >
              <SelectTrigger className="w-full sm:w-96" aria-label="Course">
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {courseSelectItems.map((course) => (
                  <SelectItem key={course.value} value={course.value}>
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
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
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
                    className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
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
                  className="border-border hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-5">
                    <p className="font-medium text-foreground">
                      {material.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {material.id}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {selectedCourse?.code ?? material.courseId}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <p>PDF</p>
                    <p className="text-xs text-muted-foreground">
                      {material.originalFilename}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={material.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <p>{material.uploadedBy.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {material.uploadedBy.email}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {materialDateFormatter.format(new Date(material.updatedAt))}
                  </TableCell>
                  <TableCell className="px-6 py-5">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
