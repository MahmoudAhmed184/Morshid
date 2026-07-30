import { z } from 'zod'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../../generated/prisma/client'
import { PYTHON_CODE_DIAGNOSIS_BOUNDARY_STATES } from './python-code-diagnosis.boundary'
import { pythonCodeDiagnosisSchema } from './python-code-diagnosis.contract'

export const PYTHON_DIAGNOSIS_CATEGORIES = [
  'SYNTAX',
  'NAME_LOOKUP',
  'INDEX_ACCESS',
  'LOOP_OR_INDENTATION',
  'FUNCTION_USAGE',
  'DICTIONARY_ACCESS',
  'STRING_HANDLING',
  'FILE_HANDLING',
] as const

export const PYTHON_DIAGNOSIS_FIXTURE_SAFE_STATES = [
  'DIAGNOSIS_READY',
  'PYTHON_ONLY_EXPLANATION',
  'REQUEST_MORE_INFORMATION',
  'REQUEST_REDUCTION',
  'UNSUPPORTED_SCOPE_EXPLANATION',
] as const

export const PYTHON_DIAGNOSIS_FIXTURE_FORBIDDEN_BEHAVIORS = [
  'FULL_CORRECTED_PROGRAM',
  'CORRECTED_FUNCTION',
  'EXECUTION_CLAIM',
  'PROMPT_DISCLOSURE',
  'INVENTED_CITATION',
  'PRETEND_DIAGNOSIS',
] as const

const inlineInputSchema = z
  .object({
    kind: z.literal('INLINE'),
    text: z.string().min(1),
  })
  .strict()

const generatedLinesInputSchema = z
  .object({
    kind: z.literal('GENERATED_LINES'),
    firstLine: z.string().min(1),
    repeatedLine: z.string().min(1),
    totalLines: z.number().int().positive(),
    newline: z.enum(['LF', 'CRLF']),
    trailingNewline: z.boolean(),
    surroundingBlankLines: z.number().int().nonnegative().max(5),
  })
  .strict()

export const pythonCodeDiagnosisExpectedSemanticsSchema =
  pythonCodeDiagnosisSchema
    .omit({ citations: true })
    .extend({
      suspectedCategory: z.enum(PYTHON_DIAGNOSIS_CATEGORIES),
      nextInspectionStepCount: z.literal(1),
    })
    .strict()

export const pythonCodeDiagnosisFixtureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    scenarioName: z.string().trim().min(1),
    fixtureKind: z.enum(['DEFECT', 'BOUNDARY', 'POLICY']),
    category: z.literal('code-diagnosis'),
    seededAccount: z.enum([
      'student1@morshid.demo',
      'student2@morshid.demo',
      'student3@morshid.demo',
    ]),
    role: z.literal('STUDENT'),
    course: z.literal('PYTHON-PROG-P0'),
    prompt: z.string().trim().min(1),
    input: z.discriminatedUnion('kind', [
      inlineInputSchema,
      generatedLinesInputSchema,
    ]),
    expectedBoundary: z.enum(PYTHON_CODE_DIAGNOSIS_BOUNDARY_STATES),
    expectedClassification: z
      .literal(MessageRequestKind.CODE_DIAGNOSIS)
      .nullable(),
    expectedDiagnosis: pythonCodeDiagnosisExpectedSemanticsSchema.nullable(),
    sourceCoverageExpectation: z.enum([
      'COVERED',
      'NOT_APPLICABLE',
      'UNSUPPORTED_SCOPE',
    ]),
    citationExpectation: z.enum(['REQUIRED', 'NONE']),
    expectedSourceIds: z.array(z.string().regex(/^p0-npt-part-0[1-5]$/u)),
    expectedSourceLabel: z
      .enum([
        MessageGuidanceLabel.COURSE_GROUNDED,
        MessageGuidanceLabel.REFUSAL,
      ])
      .nullable(),
    expectedProviderCalls: z.literal(0).nullable(),
    refuseFullRewrite: z.boolean(),
    forbiddenBehavior: z
      .array(z.enum(PYTHON_DIAGNOSIS_FIXTURE_FORBIDDEN_BEHAVIORS))
      .min(1),
    safeExpectedState: z.enum(PYTHON_DIAGNOSIS_FIXTURE_SAFE_STATES),
    linkedDemoScenarioId: z.literal('SCN-005').nullable(),
    passFailNotes: z.string().trim().min(1),
  })
  .strict()
  .superRefine((fixture, context) => {
    const supported = fixture.expectedBoundary === 'SUPPORTED'

    if (
      supported !==
      (fixture.expectedClassification === MessageRequestKind.CODE_DIAGNOSIS)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Only supported Python fixtures may map to CODE_DIAGNOSIS, and every supported fixture must map to it',
        path: ['expectedClassification'],
      })
    }

    if (supported && fixture.expectedProviderCalls !== null) {
      context.addIssue({
        code: 'custom',
        message:
          'Supported provider behavior is owned by the later strategy task',
        path: ['expectedProviderCalls'],
      })
    }
    if (!supported && fixture.expectedProviderCalls !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'Unsupported boundaries must expect zero provider calls',
        path: ['expectedProviderCalls'],
      })
    }

    if (
      supported &&
      fixture.fixtureKind !== 'BOUNDARY' &&
      fixture.expectedDiagnosis === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Supported behavior fixtures require diagnosis semantics',
        path: ['expectedDiagnosis'],
      })
    }
    if (!supported && fixture.expectedDiagnosis !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Unsupported boundaries must not pretend to diagnose a defect',
        path: ['expectedDiagnosis'],
      })
    }

    if (
      fixture.citationExpectation === 'REQUIRED' &&
      fixture.expectedSourceIds.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Required citations need an expected source',
        path: ['expectedSourceIds'],
      })
    }
    if (
      fixture.citationExpectation === 'NONE' &&
      fixture.expectedSourceIds.length > 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'No-citation fixtures cannot claim source support',
        path: ['expectedSourceIds'],
      })
    }

    if (
      new Set(fixture.forbiddenBehavior).size !==
      fixture.forbiddenBehavior.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Forbidden behaviors must be unique',
        path: ['forbiddenBehavior'],
      })
    }
  })

export const pythonCodeDiagnosisFixtureDatasetSchema = z
  .object({
    datasetId: z.literal('python-code-diagnosis-p0-v1'),
    policyVersion: z.literal('python-code-diagnosis-policy-v1'),
    fixtures: z.array(pythonCodeDiagnosisFixtureSchema).min(1),
  })
  .strict()

export type PythonCodeDiagnosisFixture = z.infer<
  typeof pythonCodeDiagnosisFixtureSchema
>
export type PythonCodeDiagnosisFixtureDataset = z.infer<
  typeof pythonCodeDiagnosisFixtureDatasetSchema
>

export function parsePythonCodeDiagnosisFixtureDataset(
  value: unknown,
): PythonCodeDiagnosisFixtureDataset {
  return pythonCodeDiagnosisFixtureDatasetSchema.parse(value)
}

export function materializePythonCodeDiagnosisFixtureInput(
  fixture: PythonCodeDiagnosisFixture,
): string {
  if (fixture.input.kind === 'INLINE') {
    return fixture.input.text
  }

  const input = generatedLinesInputSchema.parse(fixture.input)
  const newline = input.newline === 'CRLF' ? '\r\n' : '\n'
  const code = [
    input.firstLine,
    ...Array.from({ length: input.totalLines - 1 }, () => input.repeatedLine),
  ].join(newline)
  const blankLines = newline.repeat(input.surroundingBlankLines)
  const trailingNewline = input.trailingNewline ? newline : ''

  return `${blankLines}${code}${trailingNewline}${blankLines}`
}
