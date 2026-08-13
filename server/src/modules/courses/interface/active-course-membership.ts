import type { DatabaseTransaction } from '../../../platform/database/database-transaction'

export interface ActiveCourseMembershipInput {
  courseId: string
  userId: string
}

export abstract class ActiveCourseMembership {
  abstract lockInstructor(
    input: ActiveCourseMembershipInput,
    transaction: DatabaseTransaction,
  ): Promise<boolean>

  abstract lockStudent(
    input: ActiveCourseMembershipInput,
    transaction: DatabaseTransaction,
  ): Promise<boolean>
}
