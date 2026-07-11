import { useQuery } from '@tanstack/react-query'
import { Grid2X2Icon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPanel } from '../components/admin-panel'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminStatusBadge } from '../components/admin-status-badge'
import { adminCoursesQueryOptions } from '../data/admin-ops.queries'

export function AdminCoursesPage() {
  const coursesQuery = useQuery(adminCoursesQueryOptions())

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Course Operations"
        title="Course Management"
        description="Manage academic offerings, instructor ownership, enrollment metadata, and material counts."
        actions={
          <div className="flex gap-2">
            <Button variant="outline">
              <Grid2X2Icon />
              Grid
            </Button>
            <Button>
              <PlusIcon />
              Create Course
            </Button>
          </div>
        }
      />

      <AdminPanel>
        <DataTableState
          isLoading={coursesQuery.isPending}
          isError={coursesQuery.isError}
          isEmpty={coursesQuery.data?.length === 0}
          emptyTitle="No courses found"
          emptyDescription="Course records returned by the API will appear here."
        >
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {[
                  'Course',
                  'Instructor',
                  'Academic Year',
                  'Status',
                  'Materials',
                  'Enrollments',
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
              {coursesQuery.data?.map((course) => (
                <TableRow
                  key={course.id}
                  className="border-border hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-5">
                    <p className="font-medium text-foreground">
                      {course.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {course.code}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {course.instructor}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {course.academicYear}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={course.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {course.materials} units
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {course.enrollments}
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
