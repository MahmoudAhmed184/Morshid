import { z } from 'zod'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../../generated/prisma/client'
import {
  parseTutorDecision,
  type TutorDecision,
} from '../tutor-decision.contract'

export const PYTHON_CODE_DIAGNOSIS_MAX_LINES = 100
export const PYTHON_CODE_DIAGNOSIS_PROMPT_VERSION =
  'python-code-diagnosis-prompt-v1'
export const PYTHON_CODE_DIAGNOSIS_POLICY_VERSION =
  'python-code-diagnosis-policy-v1'

export const PYTHON_CODE_DIAGNOSIS_UNTRUSTED_FIELDS = [
  'STUDENT_MESSAGE',
  'STUDENT_CODE',
  'CODE_COMMENTS',
  'CODE_STRINGS',
  'IDENTIFIERS',
  'ERROR_TEXT',
  'RETRIEVED_COURSE_CONTENT',
] as const

export const PYTHON_CODE_DIAGNOSIS_OUTPUT_POLICY_RESULTS = [
  'ALLOWED_DIAGNOSIS',
  'INVALID_RESPONSE_SHAPE',
  'FULL_REWRITE_SUSPECTED',
  'CODE_BLOCK_TOO_LARGE',
  'PROMPT_DISCLOSURE',
  'EXECUTION_CLAIM',
  'INVALID_CITATION',
  'UNSUPPORTED_SCOPE',
] as const

export const pythonCodeDiagnosisCitationSchema = z
  .object({
    materialId: z.uuid(),
    chunkId: z.uuid(),
  })
  .strict()

export const pythonCodeDiagnosisSchema = z
  .object({
    likelyDefect: z.string().trim().min(1).max(1_000),
    location: z.string().trim().min(1).max(500),
    conceptExplanation: z.string().trim().min(1).max(2_000),
    nextInspectionStep: z.string().trim().min(1).max(1_000),
    citations: z.array(pythonCodeDiagnosisCitationSchema).max(50),
  })
  .strict()

export type PythonCodeDiagnosis = z.infer<typeof pythonCodeDiagnosisSchema>
export type PythonCodeDiagnosisOutputPolicyResult =
  (typeof PYTHON_CODE_DIAGNOSIS_OUTPUT_POLICY_RESULTS)[number]

const parsedDecision = parseTutorDecision({
  requestKind: MessageRequestKind.CODE_DIAGNOSIS,
  strategy: 'PYTHON_CODE_DIAGNOSIS',
  hintLevel: null,
  promptVersion: PYTHON_CODE_DIAGNOSIS_PROMPT_VERSION,
  policyVersion: PYTHON_CODE_DIAGNOSIS_POLICY_VERSION,
  evidenceRequirement: 'COURSE_EVIDENCE_REQUIRED',
  forbiddenOutputs: [
    'FULL_CORRECTED_CODE',
    'PROMPT_DISCLOSURE',
    'EXECUTION_CLAIM',
    'INVENTED_CITATION',
  ],
  guidanceLabel: MessageGuidanceLabel.COURSE_GROUNDED,
})

export const PYTHON_CODE_DIAGNOSIS_TUTOR_DECISION: TutorDecision =
  Object.freeze({
    ...parsedDecision,
    forbiddenOutputs: Object.freeze([...parsedDecision.forbiddenOutputs]),
  })

export function parsePythonCodeDiagnosis(value: unknown): PythonCodeDiagnosis {
  return pythonCodeDiagnosisSchema.parse(value)
}
