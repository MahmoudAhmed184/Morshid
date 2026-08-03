import { Injectable } from '@nestjs/common'

import { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { TopicStatePatch, TopicStateSnapshot } from './topic-state.types'

export abstract class TopicStateRepository {
  abstract topicExists(topicId: string): Promise<boolean>

  abstract findByTopicId(topicId: string): Promise<TopicStateSnapshot | null>

  abstract createForTopic(topicId: string): Promise<TopicStateSnapshot | null>

  abstract applyVersionedPatch(input: {
    topicId: string
    expectedVersion: number
    patch: TopicStatePatch
  }): Promise<TopicStateSnapshot | null>
}

export const topicStateSelect = {
  id: true,
  topicId: true,
  version: true,
  requestKind: true,
  studentState: true,
  activeStrategy: true,
  primaryTechnique: true,
  supportingTechnique: true,
  guidanceLevel: true,
  revealPolicy: true,
  attemptCount: true,
  meaningfulAttemptCount: true,
  misconceptionStatus: true,
  learningStatus: true,
  resolutionEvidenceStrength: true,
  summary: true,
  lastTutorQuestion: true,
  lastStudentAction: true,
  resolved: true,
  updatedAt: true,
} satisfies Prisma.TopicStateSelect

@Injectable()
export class PrismaTopicStateRepository extends TopicStateRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async topicExists(topicId: string): Promise<boolean> {
    const topic = await this.prismaService.topic.findUnique({
      where: { id: topicId },
      select: { id: true },
    })

    return topic !== null
  }

  findByTopicId(topicId: string): Promise<TopicStateSnapshot | null> {
    return this.prismaService.topicState.findUnique({
      where: { topicId },
      select: topicStateSelect,
    })
  }

  async createForTopic(topicId: string): Promise<TopicStateSnapshot | null> {
    return this.prismaService.topicState
      .create({
        data: { topicId },
        select: topicStateSelect,
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          return null
        }

        throw error
      })
  }

  async applyVersionedPatch(input: {
    topicId: string
    expectedVersion: number
    patch: TopicStatePatch
  }): Promise<TopicStateSnapshot | null> {
    const updated = await this.prismaService.$queryRaw<TopicStateSnapshot[]>`
      UPDATE "topic_states"
      SET ${Prisma.join(topicStatePatchAssignments(input.patch), ', ')}
      WHERE "topic_id" = ${input.topicId}::uuid
        AND "version" = ${input.expectedVersion}
      RETURNING
        "id"::text AS "id",
        "topic_id"::text AS "topicId",
        "version",
        "request_kind" AS "requestKind",
        "student_state" AS "studentState",
        "active_strategy" AS "activeStrategy",
        "primary_technique" AS "primaryTechnique",
        "supporting_technique" AS "supportingTechnique",
        "guidance_level" AS "guidanceLevel",
        "reveal_policy" AS "revealPolicy",
        "attempt_count" AS "attemptCount",
        "meaningful_attempt_count" AS "meaningfulAttemptCount",
        "misconception_status" AS "misconceptionStatus",
        "learning_status" AS "learningStatus",
        "resolution_evidence_strength" AS "resolutionEvidenceStrength",
        "summary",
        "last_tutor_question" AS "lastTutorQuestion",
        "last_student_action" AS "lastStudentAction",
        "resolved",
        "updated_at" AS "updatedAt"
    `

    return updated[0] ?? null
  }
}

function topicStatePatchAssignments(patch: TopicStatePatch): Prisma.Sql[] {
  const assignments = [
    Prisma.sql`"version" = "version" + 1`,
    Prisma.sql`"updated_at" = CURRENT_TIMESTAMP`,
  ]

  if ('requestKind' in patch) {
    assignments.push(
      Prisma.sql`"request_kind" = ${patch.requestKind}::message_request_kind`,
    )
  }
  if ('studentState' in patch) {
    assignments.push(
      Prisma.sql`"student_state" = ${patch.studentState}::student_state`,
    )
  }
  if ('activeStrategy' in patch) {
    assignments.push(
      Prisma.sql`"active_strategy" = ${patch.activeStrategy}::teaching_strategy`,
    )
  }
  if ('primaryTechnique' in patch) {
    assignments.push(
      Prisma.sql`"primary_technique" = ${patch.primaryTechnique}::teaching_technique`,
    )
  }
  if ('supportingTechnique' in patch) {
    assignments.push(
      Prisma.sql`"supporting_technique" = ${patch.supportingTechnique}::teaching_technique`,
    )
  }
  if ('guidanceLevel' in patch) {
    assignments.push(Prisma.sql`"guidance_level" = ${patch.guidanceLevel}`)
  }
  if ('revealPolicy' in patch) {
    assignments.push(
      Prisma.sql`"reveal_policy" = ${patch.revealPolicy}::reveal_policy`,
    )
  }
  if ('attemptCount' in patch) {
    assignments.push(Prisma.sql`"attempt_count" = ${patch.attemptCount}`)
  }
  if ('meaningfulAttemptCount' in patch) {
    assignments.push(
      Prisma.sql`"meaningful_attempt_count" = ${patch.meaningfulAttemptCount}`,
    )
  }
  if ('misconceptionStatus' in patch) {
    assignments.push(
      Prisma.sql`"misconception_status" = ${patch.misconceptionStatus}::misconception_status`,
    )
  }
  if ('learningStatus' in patch) {
    assignments.push(
      Prisma.sql`"learning_status" = ${patch.learningStatus}::learning_status`,
    )
  }
  if ('resolutionEvidenceStrength' in patch) {
    assignments.push(
      Prisma.sql`"resolution_evidence_strength" = ${patch.resolutionEvidenceStrength}::resolution_evidence_strength`,
    )
  }
  if ('summary' in patch) {
    assignments.push(Prisma.sql`"summary" = ${patch.summary}`)
  }
  if ('lastTutorQuestion' in patch) {
    assignments.push(
      Prisma.sql`"last_tutor_question" = ${patch.lastTutorQuestion}`,
    )
  }
  if ('lastStudentAction' in patch) {
    assignments.push(
      Prisma.sql`"last_student_action" = ${patch.lastStudentAction}`,
    )
  }
  if ('resolved' in patch) {
    assignments.push(Prisma.sql`"resolved" = ${patch.resolved}`)
  }

  return assignments
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
