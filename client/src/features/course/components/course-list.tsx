import type { AuthRole } from '@/features/auth/schemas/auth.schema'
import type { Course } from '@/features/course/schemas/course.schema'

import { CourseCard } from './course-card'

type CourseListProps = {
  courses: Course[]
  viewerRole: AuthRole
  onEditCourse?: (course: Course) => void
  onDeleteCourse?: (course: Course) => void
}

export function CourseList({
  courses,
  viewerRole,
  onEditCourse,
  onDeleteCourse,
}: CourseListProps) {
  return (
    <ul
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Courses"
    >
      {courses.map((course) => (
        <li key={course.id} className="min-w-0">
          <CourseCard
            course={course}
            viewerRole={viewerRole}
            onEditCourse={onEditCourse}
            onDeleteCourse={onDeleteCourse}
          />
        </li>
      ))}
    </ul>
  )
}
