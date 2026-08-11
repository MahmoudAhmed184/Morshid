import { z } from 'zod'

import {
  MessageGuidanceLabel,
  MessageRequestKind,
} from '../../tutoring-values'
import { DEBUGGING_GUIDANCE_BOUNDARY_STATES } from './debugging-guidance.boundary'
import {
  DEBUGGING_GUIDANCE_CATEGORIES,
  debuggingGuidanceSchema,
} from './debugging-guidance.contract'

export const DEBUGGING_GUIDANCE_FIXTURE_SAFE_STATES = [
  'DIAGNOSIS_READY',
  'DEBUGGING_GUIDANCE_EXPLANATION',
  'REQUEST_MORE_INFORMATION',
  'REQUEST_REDUCTION',
  'UNSUPPORTED_SCOPE_EXPLANATION',
] as const

export const DEBUGGING_GUIDANCE_FIXTURE_FORBIDDEN_BEHAVIORS = [
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

export const debuggingGuidanceExpectedSemanticsSchema = debuggingGuidanceSchema
  .omit({ citations: true })
  .extend({
    suspectedCategory: z.enum(DEBUGGING_GUIDANCE_CATEGORIES),
    nextInspectionStepCount: z.literal(1),
  })
  .strict()

export const debuggingGuidanceFixtureSchema = z
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
    expectedBoundary: z.enum(DEBUGGING_GUIDANCE_BOUNDARY_STATES),
    expectedClassification: z
      .literal(MessageRequestKind.CODE_DIAGNOSIS)
      .nullable(),
    expectedDiagnosis: debuggingGuidanceExpectedSemanticsSchema.nullable(),
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
      .array(z.enum(DEBUGGING_GUIDANCE_FIXTURE_FORBIDDEN_BEHAVIORS))
      .min(1),
    safeExpectedState: z.enum(DEBUGGING_GUIDANCE_FIXTURE_SAFE_STATES),
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
          'Only supported debugging fixtures may map to CODE_DIAGNOSIS, and every supported fixture must map to it',
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

export const debuggingGuidanceFixtureDatasetSchema = z
  .object({
    datasetId: z.literal('debugging-guidance-p0-v1'),
    policyVersion: z.literal('debugging-guidance-policy-v1'),
    fixtures: z.array(debuggingGuidanceFixtureSchema).min(1),
  })
  .strict()

export type DebuggingGuidanceFixture = z.infer<
  typeof debuggingGuidanceFixtureSchema
>
export type DebuggingGuidanceFixtureDataset = z.infer<
  typeof debuggingGuidanceFixtureDatasetSchema
>

export function parseDebuggingGuidanceFixtureDataset(
  value: unknown,
): DebuggingGuidanceFixtureDataset {
  return debuggingGuidanceFixtureDatasetSchema.parse(value)
}

export function materializeDebuggingGuidanceFixtureInput(
  fixture: DebuggingGuidanceFixture,
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
