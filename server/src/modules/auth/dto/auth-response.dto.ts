import type {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/client'

export interface AuthUserDto {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface AuthAssignedCourseDto {
  id: string
  code: string
  title: string
  membershipRole: CourseMembershipRole
}

export interface AuthProfileDto extends AuthUserDto {
  status: UserStatus
  assignedCourses: AuthAssignedCourseDto[]
}

export interface AuthResponseDto {
  accessToken: string
  user: AuthUserDto
}
