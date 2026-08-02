import { Injectable } from '@nestjs/common'

import { MessageRequestKind } from '../../generated/prisma/client'

export interface CorrectnessSensitiveRequestClassification {
  readonly requestKind: MessageRequestKind
  readonly correctnessSensitive: boolean
}

const OWNED_ASSESSMENT_SOLUTION =
  /\b(?:answer|complete|do|finish|solve)\b.{0,60}\b(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b/iu
const ASSESSMENT_SOLUTION_REQUEST =
  /\b(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b.{0,80}\b(?:answer|build|complete|finish|implement|solve|write)\b/iu
const COMPLETION_FOR_ASSESSMENT =
  /\b(?:answer|build|code|complete|completed|finish|implement|solve|write)\b.{0,80}\b(?:for|to)\s+(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b/iu
const FULL_DELIVERABLE_REQUEST =
  /\b(?:build|complete|give|implement|provide|show|write)\b.{0,80}\b(?:complete|final|full)\s+(?:answer|code|implementation|solution)\b/iu

@Injectable()
export class CorrectnessSensitiveRequestClassifier {
  classify(content: string): CorrectnessSensitiveRequestClassification {
    const normalized = content.replace(/\s+/gu, ' ').trim()
    const correctnessSensitive =
      OWNED_ASSESSMENT_SOLUTION.test(normalized) ||
      ASSESSMENT_SOLUTION_REQUEST.test(normalized) ||
      COMPLETION_FOR_ASSESSMENT.test(normalized) ||
      FULL_DELIVERABLE_REQUEST.test(normalized)

    return Object.freeze({
      requestKind: correctnessSensitive
        ? MessageRequestKind.PROBLEM_LIKE
        : MessageRequestKind.CONCEPTUAL,
      correctnessSensitive,
    })
  }
}
