import {
  TUTOR_GENERATION_PROMPT_VERSION,
  TutorPromptDefinitionNotFoundError,
  getTutorPromptDefinition,
  listTutorPromptDefinitions,
} from './tutor-prompt.registry'

describe('tutor prompt registry', () => {
  it('contains exactly the MVP tutor generation prompt definition', () => {
    expect(listTutorPromptDefinitions()).toHaveLength(1)
    expect(getTutorPromptDefinition(TUTOR_GENERATION_PROMPT_VERSION)).toEqual(
      expect.objectContaining({
        id: TUTOR_GENERATION_PROMPT_VERSION,
        version: TUTOR_GENERATION_PROMPT_VERSION,
        role: 'tutor_generation',
        requiredInputContract: expect.arrayContaining([
          'authoritative TeachingDecision',
          'accepted EducationalAnalysis',
          'current Student Message',
        ]) as readonly string[],
        expectedOutputContract: expect.arrayContaining([
          'message',
          'selfReportedCompliance',
        ]) as readonly string[],
        mvpConstraints: expect.arrayContaining([
          'provider/model/prompt/token metadata are backend-owned',
        ]) as readonly string[],
      }),
    )
  })

  it('fails safely for unknown tutor prompt versions', () => {
    expect(() => getTutorPromptDefinition('tutor-generation.mvp.v5')).toThrow(
      TutorPromptDefinitionNotFoundError,
    )
  })
})
