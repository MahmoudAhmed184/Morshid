export const CourseMembershipRole = {
  INSTRUCTOR: 'INSTRUCTOR',
  STUDENT: 'STUDENT',
} as const

export type CourseMembershipRole =
  (typeof CourseMembershipRole)[keyof typeof CourseMembershipRole]
