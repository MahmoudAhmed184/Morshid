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
          <TableHead>Course</TableHead>
          <TableHead>Instructors</TableHead>
          <TableHead>Students</TableHead>
          <TableHead>Materials</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {courses.map((course) => {
          const instructors = course.adminMetadata.memberships
            .filter((membership) => membership.role === 'INSTRUCTOR')
            .map((membership) => membership.user.displayName)

          return (
            <TableRow key={course.id}>
              <TableCell>
                <p className="font-medium">{course.title}</p>
                <p className="text-xs text-muted-foreground">{course.code}</p>
              </TableCell>
              <TableCell>
                {instructors.length > 0
                  ? instructors.join(', ')
                  : 'Not assigned'}
              </TableCell>
              <TableCell>{course.adminMetadata.studentCount}</TableCell>
              <TableCell>
                {course.adminMetadata.activeMaterialCount} ready /{' '}
                {course.adminMetadata.materialCount} total
              </TableCell>
              <TableCell>
                {dateFormatter.format(new Date(course.adminMetadata.updatedAt))}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
