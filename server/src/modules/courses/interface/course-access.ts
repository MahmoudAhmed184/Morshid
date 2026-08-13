import type { AuthenticatedUser } from '../../identity/identity.types'

export type CourseMaterialManagementAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: 'COURSE_NOT_FOUND' | 'COURSE_MANAGEMENT_REQUIRED'
    }

export abstract class CourseAccess {
  abstract canViewCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean>

  abstract canManageCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean>

  abstract authorizeCourseMaterialManagement(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<CourseMaterialManagementAccess>
}
