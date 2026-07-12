import { useState } from 'react'

import { DataTableState } from '@/components/ui/custom/data-table-state'
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
        <div className="border-b p-4">
          <Select
            value={courseId ?? ''}
            onValueChange={(value) => setSelectedCourseId(value ?? '')}
          >
            <SelectTrigger className="w-full sm:w-96" aria-label="Course">
              <SelectValue placeholder="Choose a course" />
            </SelectTrigger>
            <SelectContent>
              {coursesQuery.data?.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                  'Filename',
                  'Status',
                  'Chunks',
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
                    {material.originalFilename}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={material.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {material.chunkCount ?? '—'}
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
