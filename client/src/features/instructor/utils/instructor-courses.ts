import type { AuthCourseSummary } from '@/features/auth/types/auth.types'

export function getPrimaryInstructorCourse(courses: AuthCourseSummary[]) {
  return courses.length > 0 ? courses[0] : null
}
