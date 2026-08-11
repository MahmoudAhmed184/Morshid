import { z } from 'zod'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../tutoring-values'
import {
  parseTutorDecision,
  type TutorDecision,
} from '../tutor-decision.contract'
export const DEBUGGING_GUIDANCE_PROMPT_VERSION = 'debugging-guidance-prompt-v1'

export const DEBUGGING_GUIDANCE_MAX_LINES = 100
export const DEBUGGING_GUIDANCE_POLICY_VERSION = 'debugging-guidance-policy-v1'

export const DEBUGGING_GUIDANCE_CATEGORIES = [
  'SYNTAX',
  'NAME_LOOKUP',
  'INDEX_ACCESS',
  'LOOP_OR_INDENTATION',
  'FUNCTION_USAGE',
  'DICTIONARY_ACCESS',
  'STRING_HANDLING',
  'FILE_HANDLING',
] as const

export const DEBUGGING_GUIDANCE_TRACE_ACTION = 'TRACE_EXECUTION'

export const DEBUGGING_GUIDANCE_UNTRUSTED_FIELDS = [
  'STUDENT_MESSAGE',
  'STUDENT_CODE',
  'CODE_COMMENTS',
  'CODE_STRINGS',
  'IDENTIFIERS',
  'ERROR_TEXT',
  'RETRIEVED_COURSE_CONTENT',
] as const

export const DEBUGGING_GUIDANCE_RESPONSE_GOVERNANCE_RESULTS = [
  'ALLOWED_DIAGNOSIS',
  'INVALID_RESPONSE_SHAPE',
  'FULL_REWRITE_SUSPECTED',
  'CODE_BLOCK_TOO_LARGE',
  'PROMPT_DISCLOSURE',
  'EXECUTION_CLAIM',
  'INVALID_CITATION',
  'UNSUPPORTED_SCOPE',
] as const

export const debuggingGuidanceCitationSchema = z
  .object({
    materialId: z.uuid(),
    chunkId: z.uuid(),
  })
  .strict()

export const debuggingGuidanceSchema = z
  .object({
    likelyDefect: z.string().trim().min(1).max(1_000),
    location: z.string().trim().min(1).max(500),
    conceptExplanation: z.string().trim().min(1).max(2_000),
    nextInspectionStep: z.string().trim().min(1).max(1_000),
    citations: z.array(debuggingGuidanceCitationSchema).max(50),
  })
  .strict()

export type DebuggingGuidance = z.infer<typeof debuggingGuidanceSchema>
export type DebuggingGuidanceResponseGovernanceResult =
  (typeof DEBUGGING_GUIDANCE_RESPONSE_GOVERNANCE_RESULTS)[number]

const parsedDecision = parseTutorDecision({
  requestKind: MessageRequestKind.CODE_DIAGNOSIS,
  strategy: 'DEBUGGING_GUIDANCE',
  hintLevel: null,
  promptVersion: DEBUGGING_GUIDANCE_PROMPT_VERSION,
  policyVersion: DEBUGGING_GUIDANCE_POLICY_VERSION,
  evidenceRequirement: 'COURSE_EVIDENCE_REQUIRED',
  forbiddenOutputs: [
    'FULL_CORRECTED_CODE',
    'PROMPT_DISCLOSURE',
    'EXECUTION_CLAIM',
    'INVENTED_CITATION',
  ],
  guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
})

export const DEBUGGING_GUIDANCE_TUTOR_DECISION: TutorDecision = Object.freeze({
  ...parsedDecision,
  forbiddenOutputs: Object.freeze([...parsedDecision.forbiddenOutputs]),
})

export function parseDebuggingGuidance(value: unknown): DebuggingGuidance {
  return debuggingGuidanceSchema.parse(value)
}
