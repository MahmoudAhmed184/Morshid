import { z } from 'zod'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../../generated/prisma/client'

export const TUTOR_STRATEGIES = [
  'GROUNDED_EXPLANATION',
  'SOCRATIC_HINT',
  'DEBUGGING_GUIDANCE',
  'SAFE_REFUSAL',
] as const

export const TUTOR_EVIDENCE_REQUIREMENTS = [
  'COURSE_EVIDENCE_REQUIRED',
  'COURSE_EVIDENCE_OPTIONAL',
  'NO_EVIDENCE',
] as const

export const TUTOR_FORBIDDEN_OUTPUTS = [
  'FINAL_ANSWER',
  'FULL_CORRECTED_CODE',
  'PROMPT_DISCLOSURE',
  'EXECUTION_CLAIM',
  'INVENTED_CITATION',
] as const

export const tutorDecisionSchema = z
  .object({
    requestKind: z.enum(MessageRequestKind),
    strategy: z.enum(TUTOR_STRATEGIES),
    hintLevel: z.number().int().min(1).max(4).nullable(),
    promptVersion: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/u),
    policyVersion: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/u),
    evidenceRequirement: z.enum(TUTOR_EVIDENCE_REQUIREMENTS),
    forbiddenOutputs: z.array(z.enum(TUTOR_FORBIDDEN_OUTPUTS)).min(1),
    guidanceLabel: z.enum(MessageGuidanceLabel),
  })
  .strict()
  .superRefine((decision, context) => {
    if (
      new Set(decision.forbiddenOutputs).size !==
      decision.forbiddenOutputs.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Forbidden outputs must be unique',
        path: ['forbiddenOutputs'],
      })
    }

    if (decision.requestKind !== MessageRequestKind.CODE_DIAGNOSIS) {
      return
    }

    if (
      decision.strategy !== 'DEBUGGING_GUIDANCE' &&
      decision.strategy !== 'SAFE_REFUSAL'
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Code diagnosis must use the shared debugging strategy or its safe refusal',
        path: ['strategy'],
      })
    }
    if (decision.hintLevel !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Code diagnosis does not use the Socratic hint ladder',
        path: ['hintLevel'],
      })
    }
    if (!decision.forbiddenOutputs.includes('FULL_CORRECTED_CODE')) {
      context.addIssue({
        code: 'custom',
        message: 'Code diagnosis must forbid full corrected code',
        path: ['forbiddenOutputs'],
      })
    }
    if (
      decision.strategy === 'SAFE_REFUSAL' &&
      (decision.evidenceRequirement !== 'NO_EVIDENCE' ||
        decision.guidanceLabel !== MessageGuidanceLabel.REFUSAL)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A code-diagnosis refusal must require no evidence and use the refusal label',
        path: ['strategy'],
      })
    }
  })

type ParsedTutorDecision = z.infer<typeof tutorDecisionSchema>

export type TutorDecision = Readonly<
  Omit<ParsedTutorDecision, 'forbiddenOutputs'> & {
    readonly forbiddenOutputs: readonly ParsedTutorDecision['forbiddenOutputs'][number][]
  }
>

export function parseTutorDecision(value: unknown): TutorDecision {
  return tutorDecisionSchema.parse(value)
}
