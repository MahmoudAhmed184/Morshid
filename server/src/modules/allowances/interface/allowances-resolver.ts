import type { DatabaseTransaction } from '../../../platform/database/database-transaction'
import {
  resolvePolicyDayWindow,
  type PolicyDayWindow,
} from '../policy-day/policy-day'

export { resolvePolicyDayWindow }
export type { PolicyDayWindow } from '../policy-day/policy-day'

export interface AllowanceState {
  readonly limit: number
  readonly used: number
  readonly remaining: number
  readonly resetAt: Date
  readonly policyTimeZone: string
  readonly resetCutoff: Date
  readonly policyDayStart: Date
  readonly policyDayEnd: Date
}

export abstract class AllowancesResolver {
  abstract resolvePolicyDayWindow(now?: Date): PolicyDayWindow

  abstract resolveEffectiveTutoringLimit(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<number>

  abstract resolveEffectiveReviewLimit(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<number>

  abstract resolveLatestResetCutoff(
    params: {
      studentId: string
      courseId: string
      allowanceType: 'TUTORING' | 'REVIEW'
      policyDayStart: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<Date | null>

  abstract getTutoringAllowanceState(
    params: {
      studentId: string
      courseId: string
      now?: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<AllowanceState>

  abstract getReviewAllowanceState(
    params: {
      studentId: string
      courseId: string
      now?: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<AllowanceState>
}
