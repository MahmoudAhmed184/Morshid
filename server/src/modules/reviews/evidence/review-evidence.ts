import type { ReviewMessageRole } from '../interface/review-values'
import { ReviewTriggerType } from '../interface/review-values'
import { z } from 'zod'

import type { AutomaticReviewEvidenceContribution } from './automatic-review-evidence'

const MAX_EXCERPT_CODE_POINTS = 500
const ADJACENT_CONTENT_CODE_POINTS = 2_000
const MAX_CITATIONS = 20
const MAX_RETRIEVALS = 20
const MAX_FACT_COUNT = 20

export type ReviewJsonPrimitive = string | number | boolean | null
export type ReviewJsonValue =
  | ReviewJsonPrimitive
  | { readonly [key: string]: ReviewJsonValue }
  | readonly ReviewJsonValue[]
export type ReviewJsonObject = Record<string, ReviewJsonValue>

export const REVIEW_EVIDENCE_SNAPSHOT_LIMIT_BYTES = 128 * 1024

export interface ReviewEvidenceTarget {
  id: string
  role: ReviewMessageRole
  content: string
  createdAt: Date
  completedAt: Date | null
  guidanceLabel: string | null
  requestKind: string | null
  provider: string | null
  model: string | null
  promptVersion: string | null
  responseToMessage: {
    id: string
    sequence: number
    role: ReviewMessageRole
    content: string
    createdAt: Date
  } | null
  session: {
    id: string
    courseId: string
    studentId: string
  }
  citations: {
    citationOrder: number
    material: { id: string; title: string }
  }[]
  retrievals: {
    rank: number
    similarityScore: { toString(): string } | null
    chunk: {
      id: string
      materialId: string
      chunkIndex: number
      content: string
    } | null
  }[]
}

export interface ReviewEvidenceAdjacentMessage {
  id: string
  role: ReviewMessageRole
  content: string
  createdAt: Date
  sequence: number
}

export type ReviewEvidenceRequest =
  | { kind: 'manual' }
  | {
      kind: 'automatic'
      trigger: Exclude<ReviewTriggerType, 'STUDENT_REQUEST'>
      evidence: AutomaticReviewEvidenceContribution
    }

export function buildReviewEvidenceSnapshot(
  target: ReviewEvidenceTarget,
  previousMessages: ReviewEvidenceAdjacentMessage[],
  followingMessages: ReviewEvidenceAdjacentMessage[],
  input: ReviewEvidenceRequest,
): ReviewJsonObject {
  return {
    target: {
      id: target.id,
      role: target.role,
      content: target.content,
      createdAt: target.createdAt.toISOString(),
      completedAt: target.completedAt?.toISOString() ?? null,
      guidanceLabel: target.guidanceLabel,
      requestKind: target.requestKind,
      provider: target.provider,
      model: target.model,
      promptVersion: target.promptVersion,
    },
    studentPrompt: target.responseToMessage
      ? {
          id: target.responseToMessage.id,
          content:
            input.kind === 'automatic' &&
            input.trigger === ReviewTriggerType.POLICY_CHECK_FAILED
              ? '[Redacted policy-review prompt]'
              : truncate(
                  target.responseToMessage.content,
                  ADJACENT_CONTENT_CODE_POINTS,
                ),
          createdAt: target.responseToMessage.createdAt.toISOString(),
        }
      : null,
    context: {
      previousMessages: previousMessages.map(snapshotMessage),
      followingMessages: followingMessages.map(snapshotMessage),
    },
    citations: target.citations.map((citation) => ({
      order: citation.citationOrder,
      materialId: citation.material.id,
      title: citation.material.title,
    })),
    retrievals: target.retrievals.map((retrieval) => ({
      rank: retrieval.rank,
      score: retrieval.similarityScore?.toString() ?? null,
      chunkId: retrieval.chunk?.id ?? null,
      materialId: retrieval.chunk?.materialId ?? null,
      chunkNumber:
        retrieval.chunk === null ? null : retrieval.chunk.chunkIndex + 1,
      excerpt:
        retrieval.chunk === null
          ? null
          : truncate(
              retrieval.chunk.content.replace(/\s+/gu, ' ').trim(),
              MAX_EXCERPT_CODE_POINTS,
            ),
    })),
    automaticEvidence:
      input.kind === 'automatic'
        ? automaticEvidenceSnapshot(input.evidence)
        : null,
    integrity: {
      courseId: target.session.courseId,
      studentId: target.session.studentId,
      sessionId: target.session.id,
      trigger:
        input.kind === 'manual'
          ? ReviewTriggerType.STUDENT_REQUEST
          : input.trigger,
    },
  }
}

export function automaticEvidenceSnapshot(
  evidence: AutomaticReviewEvidenceContribution,
): ReviewJsonObject {
  return {
    summary: evidence.summary,
    sources: evidence.sources.map((source) => ({
      ...(source.materialId === undefined
        ? {}
        : { materialId: source.materialId }),
      ...(source.materialTitle === undefined
        ? {}
        : { materialTitle: source.materialTitle }),
      ...(source.chunkId === undefined ? {} : { chunkId: source.chunkId }),
      ...(source.chunkIndex === undefined
        ? {}
        : { chunkIndex: source.chunkIndex }),
      excerpt: source.excerpt,
      ...(source.rank === undefined ? {} : { rank: source.rank }),
      ...(source.score === undefined ? {} : { score: source.score }),
    })),
    facts: evidence.facts.map((fact) => ({
      code: fact.code,
      value: fact.value,
    })),
  }
}

const evidenceMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['STUDENT', 'ASSISTANT']),
    content: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict()

const automaticEvidenceSchema = z
  .object({
    summary: z.string(),
    sources: z
      .array(
        z
          .object({
            materialId: z.string().optional(),
            materialTitle: z.string().optional(),
            chunkId: z.string().optional(),
            chunkIndex: z.number().int().nonnegative().optional(),
            excerpt: z.string(),
            rank: z.number().int().positive().optional(),
            score: z.number().optional(),
          })
          .strict(),
      )
      .max(MAX_RETRIEVALS),
    facts: z
      .array(
        z
          .object({
            code: z.string(),
            value: z.union([z.string(), z.number(), z.boolean()]),
          })
          .strict(),
      )
      .max(MAX_FACT_COUNT),
  })
  .strict()

export const reviewEvidenceSchema = z
  .object({
    target: z
      .object({
        id: z.string(),
        role: z.enum(['STUDENT', 'ASSISTANT']),
        content: z.string(),
        createdAt: z.iso.datetime(),
        completedAt: z.iso.datetime().nullable(),
        guidanceLabel: z.string().nullable(),
        requestKind: z.string().nullable(),
        provider: z.string().nullable(),
        model: z.string().nullable(),
        promptVersion: z.string().nullable(),
      })
      .strict(),
    studentPrompt: z
      .object({
        id: z.string(),
        content: z.string(),
        createdAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    context: z
      .object({
        previousMessages: z.array(evidenceMessageSchema),
        followingMessages: z.array(evidenceMessageSchema),
      })
      .strict(),
    citations: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            materialId: z.string(),
            title: z.string(),
          })
          .strict(),
      )
      .max(MAX_CITATIONS),
    retrievals: z
      .array(
        z
          .object({
            rank: z.number().int().positive(),
            materialId: z.string().nullable(),
            chunkId: z.string().nullable(),
            chunkNumber: z.number().int().positive().nullable(),
            score: z.string().nullable(),
            excerpt: z.string().nullable(),
          })
          .strict(),
      )
      .max(MAX_RETRIEVALS),
    automaticEvidence: automaticEvidenceSchema.nullable(),
    integrity: z
      .object({
        courseId: z.string(),
        studentId: z.string(),
        sessionId: z.string(),
        trigger: z.enum(ReviewTriggerType),
      })
      .strict(),
  })
  .strict()

export type ReviewEvidenceSnapshot = z.infer<typeof reviewEvidenceSchema>

export function parseReviewEvidence(
  value: unknown,
): ReviewEvidenceSnapshot | null {
  const parsed = reviewEvidenceSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function snapshotMessage(message: ReviewEvidenceAdjacentMessage) {
  return {
    id: message.id,
    role: message.role,
    content: truncate(message.content, ADJACENT_CONTENT_CODE_POINTS),
    createdAt: message.createdAt.toISOString(),
  }
}

function truncate(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('')
}
