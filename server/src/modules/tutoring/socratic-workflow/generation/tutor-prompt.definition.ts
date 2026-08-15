export const TUTOR_GENERATION_PROMPT_VERSION = 'tutor-generation.mvp.v7'

export const TUTOR_GENERATION_PROMPT_DEFINITION = Object.freeze({
  id: TUTOR_GENERATION_PROMPT_VERSION,
  version: TUTOR_GENERATION_PROMPT_VERSION,
  role: 'tutor_generation' as const,
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
    'debuggingGuidance',
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
})
