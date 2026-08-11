import { Injectable } from '@nestjs/common'

import { MessageRequestKind } from '../../../generated/prisma/client'
import {
  isSafetyDiscussion,
  requestsObfuscatedDeliverable,
  requestsProtectedSolution,
} from './automatic-safety-request-intent'

export interface CorrectnessSensitiveRequestClassification {
  readonly requestKind: MessageRequestKind
  readonly correctnessSensitive: boolean
}

const OWNED_ASSESSMENT_SOLUTION =
  /\b(?:answer|complete|do|finish|solve)\b.{0,60}\b(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b/iu
const ASSESSMENT_SOLUTION_REQUEST =
  /\b(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b.{0,80}\b(?:answer|build|complete|finish|implement|solve|write)\b/iu
const FULL_SOLUTION_REQUEST =
  /\b(?:answer|build|code|complete|completed|finish|implement|solve|write)\b.{0,80}\b(?:for|to)\s+(?:my|this|the)\s+(?:graded\s+)?(?:assignment|assessment|exercise|exam|homework|problem|quiz|task)\b/iu
const FULL_DELIVERABLE_REQUEST =
  /\b(?:build|complete|give|implement|provide|show|write)\b.{0,80}\b(?:complete|final|full)\s+(?:answer|code|implementation|solution)\b/iu
const PROGRAM_DELIVERY_REQUEST =
  /\b(?:build|code|create|develop|implement|make|produce|write)\b.{0,80}\b(?:app|application|cli|game|program|script)\b|\b(?:app|application|cli|game|program|script)\b.{0,80}\b(?:build|code|create|develop|implement|make|produce|write)\b/iu
const FINAL_WORKING_DELIVERABLE_REQUEST =
  /\b(?:fix|finish|complete|correct|debug)\b.{0,100}\b(?:send|give|provide|show|return)\b.{0,50}\b(?:final|finished|complete|corrected|working)\s+(?:answer|code|implementation|program|solution)\b/iu
const COMPLETE_EXAMPLE_REQUEST =
  /\b(?:give|provide|send|show|write)\b.{0,50}\b(?:complete|full|finished|ready[- ]to[- ]run)\s+(?:code\s+)?example\b/iu

@Injectable()
export class CorrectnessSensitiveRequestClassifier {
  classify(content: string): CorrectnessSensitiveRequestClassification {
    const normalized = content.replace(/\s+/gu, ' ').trim()
    const correctnessSensitive =
      !isSafetyDiscussion(normalized) &&
      (OWNED_ASSESSMENT_SOLUTION.test(normalized) ||
        ASSESSMENT_SOLUTION_REQUEST.test(normalized) ||
        FULL_SOLUTION_REQUEST.test(normalized) ||
        FULL_DELIVERABLE_REQUEST.test(normalized) ||
        PROGRAM_DELIVERY_REQUEST.test(normalized) ||
        FINAL_WORKING_DELIVERABLE_REQUEST.test(normalized) ||
        COMPLETE_EXAMPLE_REQUEST.test(normalized) ||
        requestsProtectedSolution(normalized) ||
        requestsObfuscatedDeliverable(normalized))

    return Object.freeze({
      requestKind: correctnessSensitive
        ? MessageRequestKind.PROBLEM_LIKE
        : MessageRequestKind.CONCEPTUAL,
      correctnessSensitive,
    })
  }
}
