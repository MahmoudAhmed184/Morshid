import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminCourse } from '@/features/admin/schemas/admin-course.schema'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function AdminCoursesTable({ courses }: { courses: AdminCourse[] }) {
  return (
    <Table className="min-w-[820px]">
      <TableHeader>
        <TableRow>
          {['Course', 'Instructors', 'Students', 'Materials', 'Updated'].map(
            (header) => (
              <TableHead
                key={header}
                className="h-11 px-4 first:pl-6 last:pr-6"
              >
                {header}
              </TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => {
          const instructors = course.adminMetadata.memberships
            .filter((membership) => membership.role === 'INSTRUCTOR')
            .map((membership) => membership.user.displayName)

          return (
            <TableRow key={course.id}>
              <TableCell className="px-4 py-3.5 first:pl-6">
                <p className="font-medium text-foreground">{course.title}</p>
                <p className="text-xs text-muted-foreground">{course.code}</p>
              </TableCell>
              <TableCell className="px-4 py-3.5">
                {instructors.length > 0 ? (
                  instructors.join(', ')
                ) : (
                  <span className="text-muted-foreground">Not assigned</span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3.5 tabular-nums">
                {course.adminMetadata.studentCount}
              </TableCell>
              <TableCell className="px-4 py-3.5 tabular-nums">
                {course.adminMetadata.materialCount} total
              </TableCell>
              <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums last:pr-6">
                {dateFormatter.format(new Date(course.adminMetadata.updatedAt))}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
