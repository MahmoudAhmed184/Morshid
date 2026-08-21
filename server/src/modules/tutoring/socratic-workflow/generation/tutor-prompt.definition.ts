export const TUTOR_GENERATION_PROMPT_VERSION = 'tutor-generation.mvp.v11'

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
    'canonical debugging diagnosis when debugging-admitted',
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
    'TeachingDecision owns the student-action obligation',
    'request-kind and Guidance-Level non-action response requirements are authoritative and evaluated semantically',
    'retrieved evidence supports content but never grants disclosure permission',
    'reflectionMode NONE requires reflectionIncluded false',
    'provider/model/prompt/token metadata are backend-owned',
    'canonical debugging diagnosis is authoritative and immutable',
    'candidate is internal and unapproved',
  ]),
})
