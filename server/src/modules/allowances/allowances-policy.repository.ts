import { Injectable } from '@nestjs/common'

import { Prisma, AllowanceResetScope } from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import {
  asPrismaTransaction,
  type DatabaseTransaction,
} from '../../platform/database/database-transaction'
import {
  DEFAULT_TUTORING_ALLOWANCE,
  DEFAULT_REVIEW_ALLOWANCE,
} from './allowances.constants'

export interface DeploymentDefaultsRecord {
  id: string
  tutoringLimit: number
  reviewLimit: number
  updatedAt: Date
}

export interface CourseOverrideRecord {
  id: string
  courseId: string
  courseCode: string
  courseTitle: string
  tutoringLimit: number | null
  reviewLimit: number | null
  createdAt: Date
  updatedAt: Date
}

export interface AllowanceResetRecord {
  id: string
  studentId: string
  courseId: string
  scope: AllowanceResetScope
  reason: string
  createdById: string | null
  createdAt: Date
}

@Injectable()
export class AllowancesPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(
    tx?: DatabaseTransaction,
  ): Prisma.TransactionClient | PrismaService {
    return tx ? asPrismaTransaction(tx) : this.prisma
  }

  async getDeploymentDefaults(
    tx?: DatabaseTransaction,
  ): Promise<DeploymentDefaultsRecord> {
    const client = this.getClient(tx)
    let record = await client.deploymentPolicyDefault.findUnique({
      where: { id: 'default' },
    })

    record ??= await client.deploymentPolicyDefault.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        tutoringLimit: DEFAULT_TUTORING_ALLOWANCE,
        reviewLimit: DEFAULT_REVIEW_ALLOWANCE,
      },
      update: {},
    })

    return {
      id: record.id,
      tutoringLimit: record.tutoringLimit,
      reviewLimit: record.reviewLimit,
      updatedAt: record.updatedAt,
    }
  }

  async updateDeploymentDefaults(
    data: { tutoringLimit?: number; reviewLimit?: number },
    tx?: DatabaseTransaction,
  ): Promise<DeploymentDefaultsRecord> {
    const client = this.getClient(tx)
    const record = await client.deploymentPolicyDefault.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        tutoringLimit: data.tutoringLimit ?? DEFAULT_TUTORING_ALLOWANCE,
        reviewLimit: data.reviewLimit ?? DEFAULT_REVIEW_ALLOWANCE,
      },
      update: {
        ...(data.tutoringLimit !== undefined
          ? { tutoringLimit: data.tutoringLimit }
          : {}),
        ...(data.reviewLimit !== undefined
          ? { reviewLimit: data.reviewLimit }
          : {}),
      },
    })

    return {
      id: record.id,
      tutoringLimit: record.tutoringLimit,
      reviewLimit: record.reviewLimit,
      updatedAt: record.updatedAt,
    }
  }

  async getCourseOverride(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<CourseOverrideRecord | null> {
    const client = this.getClient(tx)
    const record = await client.coursePolicyOverride.findUnique({
      where: { courseId },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    })

    if (!record) return null

    return {
      id: record.id,
      courseId: record.courseId,
      courseCode: record.course.code,
      courseTitle: record.course.title,
      tutoringLimit: record.tutoringLimit,
      reviewLimit: record.reviewLimit,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async listCourseOverrides(
    tx?: DatabaseTransaction,
  ): Promise<CourseOverrideRecord[]> {
    const client = this.getClient(tx)
    const records = await client.coursePolicyOverride.findMany({
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
      },
      orderBy: {
        course: {
          code: 'asc',
        },
      },
    })

    return records.map((record) => ({
      id: record.id,
      courseId: record.courseId,
      courseCode: record.course.code,
      courseTitle: record.course.title,
      tutoringLimit: record.tutoringLimit,
      reviewLimit: record.reviewLimit,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
  }

  async setCourseOverride(
    courseId: string,
    data: { tutoringLimit?: number | null; reviewLimit?: number | null },
    tx?: DatabaseTransaction,
  ): Promise<CourseOverrideRecord> {
    const client = this.getClient(tx)
    const record = await client.coursePolicyOverride.upsert({
      where: { courseId },
      create: {
        courseId,
        tutoringLimit: data.tutoringLimit,
        reviewLimit: data.reviewLimit,
      },
      update: {
        ...(data.tutoringLimit !== undefined
          ? { tutoringLimit: data.tutoringLimit }
          : {}),
        ...(data.reviewLimit !== undefined
          ? { reviewLimit: data.reviewLimit }
          : {}),
      },
      include: {
        course: {
          select: {
            code: true,
            title: true,
          },
        },
      },
    })

    return {
      id: record.id,
      courseId: record.courseId,
      courseCode: record.course.code,
      courseTitle: record.course.title,
      tutoringLimit: record.tutoringLimit,
      reviewLimit: record.reviewLimit,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  async removeCourseOverride(
    courseId: string,
    tx?: DatabaseTransaction,
  ): Promise<boolean> {
    const client = this.getClient(tx)
    try {
      await client.coursePolicyOverride.delete({
        where: { courseId },
      })
      return true
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return false
      }
      throw error
    }
  }

  async getLatestResetCutoff(
    studentId: string,
    courseId: string,
    allowanceType: 'TUTORING' | 'REVIEW',
    policyDayStart: Date,
    tx?: DatabaseTransaction,
  ): Promise<Date | null> {
    const client = this.getClient(tx)
    const scopes: AllowanceResetScope[] =
      allowanceType === 'TUTORING'
        ? [AllowanceResetScope.TUTORING, AllowanceResetScope.BOTH]
        : [AllowanceResetScope.REVIEW, AllowanceResetScope.BOTH]

    const latest = await client.allowanceReset.findFirst({
      where: {
        studentId,
        courseId,
        scope: { in: scopes },
        createdAt: { gte: policyDayStart },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    return latest ? latest.createdAt : null
  }

  async findStudentByEmail(
    email: string,
    tx?: DatabaseTransaction,
  ): Promise<{ id: string; email: string; displayName: string } | null> {
    const client = this.getClient(tx)
    const user = await client.user.findFirst({
      where: {
        email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
        role: 'STUDENT',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    })
    return user
  }

  async createReset(
    data: {
      studentId: string
      courseId: string
      scope: AllowanceResetScope
      reason: string
      createdById: string | null
    },
    tx?: DatabaseTransaction,
  ): Promise<AllowanceResetRecord> {
    const client = this.getClient(tx)
    const record = await client.allowanceReset.create({
      data: {
        studentId: data.studentId,
        courseId: data.courseId,
        scope: data.scope,
        reason: data.reason,
        createdById: data.createdById,
      },
    })

    return {
      id: record.id,
      studentId: record.studentId,
      courseId: record.courseId,
      scope: record.scope,
      reason: record.reason,
      createdById: record.createdById,
      createdAt: record.createdAt,
    }
  }

  async countTutoringTurns(
    studentId: string,
    courseId: string,
    fromDate: Date,
    toDate: Date,
    tx?: DatabaseTransaction,
  ): Promise<number> {
    const client = this.getClient(tx)
    const [result] = await client.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "messages" m
      JOIN "chat_sessions" s ON m."session_id" = s."id"
      WHERE m."role" = 'STUDENT'
        AND m."author_user_id" = ${studentId}::uuid
        AND s."course_id" = ${courseId}::uuid
        AND m."created_at" >= ${fromDate}
        AND m."created_at" < ${toDate}
    `
    return Number(result.count)
  }

  async countReviewRequests(
    studentId: string,
    courseId: string,
    fromDate: Date,
    toDate: Date,
    tx?: DatabaseTransaction,
  ): Promise<number> {
    const client = this.getClient(tx)
    const [result] = await client.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "review_triggers" rt
      JOIN "review_cases" rc ON rt."review_case_id" = rc."id"
      WHERE rt."type" = 'STUDENT_REQUEST'
        AND rt."actor_user_id" = ${studentId}::uuid
        AND rc."course_id" = ${courseId}::uuid
        AND rt."created_at" >= ${fromDate}
        AND rt."created_at" < ${toDate}
    `
    return Number(result.count)
  }
}
