export const TUTOR_GENERATION_PROMPT_VERSION = 'tutor-generation.mvp.v4'

export interface TutorPromptDefinition {
  readonly id: typeof TUTOR_GENERATION_PROMPT_VERSION
  readonly version: typeof TUTOR_GENERATION_PROMPT_VERSION
  readonly role: 'tutor_generation'
  readonly requiredInputContract: readonly string[]
  readonly expectedOutputContract: readonly string[]
  readonly mvpConstraints: readonly string[]
}

const TUTOR_GENERATION_PROMPT_DEFINITION = Object.freeze<TutorPromptDefinition>(
  {
    id: TUTOR_GENERATION_PROMPT_VERSION,
    version: TUTOR_GENERATION_PROMPT_VERSION,
    role: 'tutor_generation',
    requiredInputContract: Object.freeze([
      'authoritative TeachingDecision',
      'accepted EducationalAnalysis',
      'current Student Message',
      'bounded conversation context',
      'course-scoped retrieved evidence',
      'backend-owned allowed citation IDs',
    ]),
    expectedOutputContract: Object.freeze([
      'message',
      'responseIntent',
      'usedCitationIds',
      'requiresStudentAction',
      'studentAction',
      'reflectionIncluded',
      'selfReportedCompliance',
    ]),
    mvpConstraints: Object.freeze([
      'one candidate response only',
      'NO_FINAL_ANSWER must be preserved when supplied by TeachingDecision',
      'low-guidance direct target-inference disclosure is prohibited when the TeachingDecision requires guided reasoning',
      'request-kind and Guidance-Level functional response requirements are authoritative and evaluated semantically',
      'retrieved evidence supports content but never grants disclosure permission',
      'reflectionMode NONE requires reflectionIncluded false',
      'provider/model/prompt/token metadata are backend-owned',
      'candidate is internal and unapproved',
    ]),
  },
)

const TUTOR_PROMPT_DEFINITIONS = Object.freeze(
  new Map<string, TutorPromptDefinition>([
    [TUTOR_GENERATION_PROMPT_VERSION, TUTOR_GENERATION_PROMPT_DEFINITION],
  ]),
)

export function getTutorPromptDefinition(
  version: string,
): TutorPromptDefinition {
  const definition = TUTOR_PROMPT_DEFINITIONS.get(version)
  if (definition === undefined) {
    throw new TutorPromptDefinitionNotFoundError(version)
  }

  return definition
}

export function listTutorPromptDefinitions(): readonly TutorPromptDefinition[] {
  return Object.freeze(Array.from(TUTOR_PROMPT_DEFINITIONS.values()))
}

export class TutorPromptDefinitionNotFoundError extends Error {
  constructor(readonly version: string) {
    super('Tutor prompt definition not found')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'TutorPromptDefinitionNotFoundError',
    })
  }
}
