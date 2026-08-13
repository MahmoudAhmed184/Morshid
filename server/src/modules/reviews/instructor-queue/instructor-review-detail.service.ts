import { Injectable } from '@nestjs/common'

import { MessageRole } from '../../conversations/interface/conversation-values'
import { ReviewMessageRole } from '../interface/review-values'
import { CourseAccess } from '../../courses/interface/course-access'
import type { AuthenticatedUser } from '../../identity/identity.types'
import { reviewNotFoundException } from '../review-case.errors'
import type {
  InstructorReviewDetailDto,
  InstructorReviewExchangeDto,
} from './instructor-review-detail.dto'
import {
  InstructorReviewDetailRepository,
  type ReviewDetailMessageRecord,
} from './instructor-review-detail.repository'

const MAX_EXCERPT_CODE_POINTS = 500

@Injectable()
export class InstructorReviewDetailService {
  constructor(
    private readonly repository: InstructorReviewDetailRepository,
    private readonly courseAccess: CourseAccess,
  ) {}

  async get(
    user: AuthenticatedUser,
    reviewCaseId: string,
  ): Promise<InstructorReviewDetailDto> {
    const courseId = await this.repository.findCourseId(reviewCaseId)
    if (
      courseId === null ||
      !(await this.courseAccess.canManageCourse(user, courseId))
    ) {
      throw reviewNotFoundException()
    }

    const record = await this.repository.findAuthorized(user.id, reviewCaseId)
    if (record === null) {
      throw reviewNotFoundException()
    }

    return {
      reviewCaseId: record.id,
      status: record.status,
      version: record.version,
      canReject: record.canReject,
      trigger: record.trigger.type,
      triggers: record.triggers.map(({ type }) => type),
      studentFlagReason: record.studentFlagReason,
      createdAt: record.createdAt.toISOString(),
      requestedAt: record.trigger.createdAt.toISOString(),
      studentNote: record.studentNote,
      course: record.course,
      student: record.student,
      flaggedExchange: presentMessage(record.flaggedExchange),
      assistantResponse: {
        ...presentMessage(record.assistantResponse),
        citations: record.assistantResponse.citations.map((citation) => ({
          order: citation.order,
          materialId: citation.materialId,
          materialTitle: citation.materialTitle,
          snippets: citation.snippets.map((snippet) => ({
            chunkNumber: snippet.chunkNumber,
            excerpt: truncate(normalize(snippet.content)),
          })),
        })),
      },
      previousExchange: presentExchange(record.previousMessages),
      followingExchange: presentExchange(record.followingMessages),
      actions: record.actions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString(),
      })),
      reviewSummary: {
        reviewCaseId: record.id,
        status: record.status,
        outcome: record.outcome,
        resolvedAt: record.resolvedAt?.toISOString() ?? null,
      },
    }
  }
}

function presentMessage(message: ReviewDetailMessageRecord) {
  return {
    role: message.role as ReviewMessageRole,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}

function presentExchange(
  messages: ReviewDetailMessageRecord[],
): InstructorReviewExchangeDto | null {
  if (messages.length === 0) return null
  const studentMessage = messages.find(
    ({ role }) => role === MessageRole.STUDENT,
  )
  const assistantResponse = messages.find(
    ({ role }) => role === MessageRole.ASSISTANT,
  )
  return {
    studentMessage:
      studentMessage === undefined ? null : presentMessage(studentMessage),
    assistantResponse:
      assistantResponse === undefined
        ? null
        : presentMessage(assistantResponse),
  }
}

function normalize(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
}

function truncate(value: string) {
  const points = Array.from(value)
  return points.length <= MAX_EXCERPT_CODE_POINTS
    ? value
    : `${points.slice(0, MAX_EXCERPT_CODE_POINTS - 1).join('')}…`
}
