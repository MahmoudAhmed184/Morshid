import { Injectable } from '@nestjs/common'

import { asPrismaTransaction } from '../../platform/database/database-transaction'
import type { DatabaseTransaction } from '../../platform/database/database-transaction'
import type { ActiveCourseMembershipInput } from './interface/active-course-membership'
import { ActiveCourseMembership } from './interface/active-course-membership'

@Injectable()
export class PrismaActiveCourseMembership extends ActiveCourseMembership {
  lockInstructor(
    input: ActiveCourseMembershipInput,
    transaction: DatabaseTransaction,
  ): Promise<boolean> {
    return this.lock(input, 'INSTRUCTOR', transaction)
  }

  lockStudent(
    input: ActiveCourseMembershipInput,
    transaction: DatabaseTransaction,
  ): Promise<boolean> {
    return this.lock(input, 'STUDENT', transaction)
  }

  private async lock(
    input: ActiveCourseMembershipInput,
    role: 'INSTRUCTOR' | 'STUDENT',
    transaction: DatabaseTransaction,
  ): Promise<boolean> {
    const tx = asPrismaTransaction(transaction)
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM course_memberships
      WHERE course_id = ${input.courseId}::uuid
        AND user_id = ${input.userId}::uuid
        AND role = ${role}::course_membership_role
        AND removed_at IS NULL
      FOR UPDATE
    `

    return rows.length === 1
  }
}
