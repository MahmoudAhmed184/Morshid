import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AuditService, type AuditRequestContext } from '../audit/audit.public'
import type { AuthenticatedUser } from '../identity/identity.types'
import type { DatabaseTransaction } from '../../platform/database/database-transaction'
import {
  DEFAULT_POLICY_TIME_ZONE,
  MAX_REVIEW_ALLOWANCE,
  MAX_TUTORING_ALLOWANCE,
  MIN_REVIEW_ALLOWANCE,
  MIN_TUTORING_ALLOWANCE,
  type AllowanceResetScope,
} from './allowances.constants'
import {
  AllowancesPolicyRepository,
  type AllowanceResetRecord,
  type CourseOverrideRecord,
  type DeploymentDefaultsRecord,
} from './allowances-policy.repository'
import {
  AllowancesResolver,
  type AllowanceState,
  type PolicyDayWindow,
} from './interface/allowances-resolver'
import { resolvePolicyDayWindow } from './policy-day/policy-day'

export type {
  AllowanceResetRecord,
  CourseOverrideRecord,
  DeploymentDefaultsRecord,
} from './allowances-policy.repository'

export interface UpdateDeploymentDefaultsInput {
  tutoringLimit?: number
  reviewLimit?: number
}

export interface SetCoursePolicyOverrideInput {
  tutoringLimit?: number | null
  reviewLimit?: number | null
}

export interface CreateAllowanceResetInput {
  studentId: string
  courseId: string
  scope: AllowanceResetScope
  reason: string
}

export interface AllowancePoliciesDto {
  deploymentDefaults: DeploymentDefaultsRecord
  courseOverrides: CourseOverrideRecord[]
  policyTimeZone: string
}

export interface StudentCourseUsageDto {
  studentId: string
  courseId: string
  tutoring: AllowanceState
  review: AllowanceState
}

@Injectable()
export class AllowancesService extends AllowancesResolver {
  constructor(
    private readonly repository: AllowancesPolicyRepository,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    super()
  }

  private get policyTimeZone(): string {
    return (
      this.configService.get<string>('POLICY_DAY_TIME_ZONE') ??
      DEFAULT_POLICY_TIME_ZONE
    )
  }

  resolvePolicyDayWindow(now: Date = new Date()): PolicyDayWindow {
    return resolvePolicyDayWindow(now, this.policyTimeZone)
  }

  async resolveEffectiveTutoringLimit(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<number> {
    const override = await this.repository.getCourseOverride(courseId, tx)
    if (
      override?.tutoringLimit !== null &&
      override?.tutoringLimit !== undefined
    ) {
      return override.tutoringLimit
    }
    const defaults = await this.repository.getDeploymentDefaults(tx)
    return defaults.tutoringLimit
  }

  async resolveEffectiveReviewLimit(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<number> {
    const override = await this.repository.getCourseOverride(courseId, tx)
    if (override?.reviewLimit !== null && override?.reviewLimit !== undefined) {
      return override.reviewLimit
    }
    const defaults = await this.repository.getDeploymentDefaults(tx)
    return defaults.reviewLimit
  }

  async resolveLatestResetCutoff(
    params: {
      studentId: string
      courseId: string
      allowanceType: 'TUTORING' | 'REVIEW'
      policyDayStart: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<Date | null> {
    return this.repository.getLatestResetCutoff(
      params.studentId,
      params.courseId,
      params.allowanceType,
      params.policyDayStart,
      tx,
    )
  }

  async getTutoringAllowanceState(
    params: {
      studentId: string
      courseId: string
      now?: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<AllowanceState> {
    const now = params.now ?? new Date()
    const window = this.resolvePolicyDayWindow(now)
    const limit = await this.resolveEffectiveTutoringLimit(params.courseId, tx)
    const latestReset = await this.resolveLatestResetCutoff(
      {
        studentId: params.studentId,
        courseId: params.courseId,
        allowanceType: 'TUTORING',
        policyDayStart: window.start,
      },
      tx,
    )
    const resetCutoff =
      latestReset && latestReset > window.start ? latestReset : window.start
    const used = await this.repository.countTutoringTurns(
      params.studentId,
      params.courseId,
      resetCutoff,
      window.end,
      tx,
    )
    const remaining = Math.max(0, limit - used)

    return {
      limit,
      used,
      remaining,
      resetAt: window.resetAt,
      policyTimeZone: window.policyTimeZone,
      resetCutoff,
      policyDayStart: window.start,
      policyDayEnd: window.end,
    }
  }

  async getReviewAllowanceState(
    params: {
      studentId: string
      courseId: string
      now?: Date
    },
    tx?: DatabaseTransaction,
  ): Promise<AllowanceState> {
    const now = params.now ?? new Date()
    const window = this.resolvePolicyDayWindow(now)
    const limit = await this.resolveEffectiveReviewLimit(params.courseId, tx)
    const latestReset = await this.resolveLatestResetCutoff(
      {
        studentId: params.studentId,
        courseId: params.courseId,
        allowanceType: 'REVIEW',
        policyDayStart: window.start,
      },
      tx,
    )
    const resetCutoff =
      latestReset && latestReset > window.start ? latestReset : window.start
    const used = await this.repository.countReviewRequests(
      params.studentId,
      params.courseId,
      resetCutoff,
      window.end,
      tx,
    )
    const remaining = Math.max(0, limit - used)

    return {
      limit,
      used,
      remaining,
      resetAt: window.resetAt,
      policyTimeZone: window.policyTimeZone,
      resetCutoff,
      policyDayStart: window.start,
      policyDayEnd: window.end,
    }
  }

  // --- Admin Policy Management ---

  async getPolicies(): Promise<AllowancePoliciesDto> {
    const deploymentDefaults = await this.repository.getDeploymentDefaults()
    const courseOverrides = await this.repository.listCourseOverrides()
    return {
      deploymentDefaults,
      courseOverrides,
      policyTimeZone: this.policyTimeZone,
    }
  }

  async updateDeploymentDefaults(
    input: UpdateDeploymentDefaultsInput,
    adminUser: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<DeploymentDefaultsRecord> {
    if (
      input.tutoringLimit !== undefined &&
      (input.tutoringLimit < MIN_TUTORING_ALLOWANCE ||
        input.tutoringLimit > MAX_TUTORING_ALLOWANCE ||
        !Number.isInteger(input.tutoringLimit))
    ) {
      throw new BadRequestException(
        `Tutoring limit must be an integer between ${String(MIN_TUTORING_ALLOWANCE)} and ${String(MAX_TUTORING_ALLOWANCE)}`,
      )
    }

    if (
      input.reviewLimit !== undefined &&
      (input.reviewLimit < MIN_REVIEW_ALLOWANCE ||
        input.reviewLimit > MAX_REVIEW_ALLOWANCE ||
        !Number.isInteger(input.reviewLimit))
    ) {
      throw new BadRequestException(
        `Review limit must be an integer between ${String(MIN_REVIEW_ALLOWANCE)} and ${String(MAX_REVIEW_ALLOWANCE)}`,
      )
    }

    const before = await this.repository.getDeploymentDefaults()
    const updated = await this.repository.updateDeploymentDefaults(input)

    await this.auditService.recordEvent({
      actorUserId: adminUser.id,
      action: 'allowance.policy_defaults_updated',
      target: { type: 'deployment_policy_default', id: 'default' },
      metadata: {
        previous: {
          tutoringLimit: before.tutoringLimit,
          reviewLimit: before.reviewLimit,
        },
        updated: {
          tutoringLimit: updated.tutoringLimit,
          reviewLimit: updated.reviewLimit,
        },
      },
      requestContext,
    })

    return updated
  }

  async setCourseOverride(
    courseId: string,
    input: SetCoursePolicyOverrideInput,
    adminUser: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<CourseOverrideRecord> {
    if (
      input.tutoringLimit !== undefined &&
      input.tutoringLimit !== null &&
      (input.tutoringLimit < MIN_TUTORING_ALLOWANCE ||
        input.tutoringLimit > MAX_TUTORING_ALLOWANCE ||
        !Number.isInteger(input.tutoringLimit))
    ) {
      throw new BadRequestException(
        `Tutoring limit must be an integer between ${String(MIN_TUTORING_ALLOWANCE)} and ${String(MAX_TUTORING_ALLOWANCE)}`,
      )
    }

    if (
      input.reviewLimit !== undefined &&
      input.reviewLimit !== null &&
      (input.reviewLimit < MIN_REVIEW_ALLOWANCE ||
        input.reviewLimit > MAX_REVIEW_ALLOWANCE ||
        !Number.isInteger(input.reviewLimit))
    ) {
      throw new BadRequestException(
        `Review limit must be an integer between ${String(MIN_REVIEW_ALLOWANCE)} and ${String(MAX_REVIEW_ALLOWANCE)}`,
      )
    }

    if (input.tutoringLimit === null && input.reviewLimit === null) {
      throw new BadRequestException(
        'At least one allowance limit must be specified for a course override',
      )
    }

    const before = await this.repository.getCourseOverride(courseId)
    const override = await this.repository.setCourseOverride(courseId, input)

    await this.auditService.recordEvent({
      actorUserId: adminUser.id,
      action: before
        ? 'allowance.course_override_updated'
        : 'allowance.course_override_created',
      target: { type: 'course_policy_override', id: override.id },
      courseId,
      metadata: {
        previous: before
          ? {
              tutoringLimit: before.tutoringLimit,
              reviewLimit: before.reviewLimit,
            }
          : null,
        updated: {
          tutoringLimit: override.tutoringLimit,
          reviewLimit: override.reviewLimit,
        },
      },
      requestContext,
    })

    return override
  }

  async removeCourseOverride(
    courseId: string,
    adminUser: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<{ success: boolean }> {
    const existing = await this.repository.getCourseOverride(courseId)
    if (!existing) {
      throw new NotFoundException(
        `Course override for course ${courseId} not found`,
      )
    }

    await this.repository.removeCourseOverride(courseId)

    await this.auditService.recordEvent({
      actorUserId: adminUser.id,
      action: 'allowance.course_override_deleted',
      target: { type: 'course_policy_override', id: existing.id },
      courseId,
      metadata: {
        deletedOverride: {
          tutoringLimit: existing.tutoringLimit,
          reviewLimit: existing.reviewLimit,
        },
      },
      requestContext,
    })

    return { success: true }
  }

  async createAllowanceReset(
    input: CreateAllowanceResetInput,
    adminUser: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<AllowanceResetRecord> {
    const trimmedReason = input.reason.trim()
    if (!trimmedReason || trimmedReason.length === 0) {
      throw new BadRequestException(
        'A reason is required for resetting student allowance',
      )
    }

    if (trimmedReason.length > 500) {
      throw new BadRequestException('Reason must not exceed 500 characters')
    }

    const reset = await this.repository.createReset({
      studentId: input.studentId,
      courseId: input.courseId,
      scope: input.scope,
      reason: trimmedReason,
      createdById: adminUser.id,
    })

    await this.auditService.recordEvent({
      actorUserId: adminUser.id,
      action: 'allowance.reset_created',
      target: { type: 'allowance_reset', id: reset.id },
      courseId: input.courseId,
      metadata: {
        studentId: input.studentId,
        scope: input.scope,
        reason: trimmedReason,
      },
      requestContext,
    })

    return reset
  }

  async getStudentUsage(
    studentId: string,
    courseId: string,
  ): Promise<StudentCourseUsageDto> {
    const tutoring = await this.getTutoringAllowanceState({
      studentId,
      courseId,
    })
    const review = await this.getReviewAllowanceState({ studentId, courseId })
    return {
      studentId,
      courseId,
      tutoring,
      review,
    }
  }
}
