import { MessageRole, MessageStatus } from '../../tutoring-values'
import type {
  AnalysisContextMessage,
  AnalysisContextPackage,
} from './analysis-context.types'
import { EducationalAnalysisResultSchema } from './educational-analysis.schema'
import {
  EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY,
  type EducationalAnalysisResult,
  type EducationalAnalysisValidationCategory,
  type EducationalAnalysisValidationIssue,
  type EducationalAnalysisValidationResult,
} from './educational-analysis.types'

export function validateEducationalAnalysisResult(
  raw: unknown,
  analysisContext: AnalysisContextPackage,
): EducationalAnalysisValidationResult {
  const parsed = EducationalAnalysisResultSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => mapZodIssue(issue, raw)),
    }
  }

  const evidenceIssues = validateEvidenceReferences(
    parsed.data,
    analysisContext,
  )

  if (evidenceIssues.length > 0) {
    return {
      success: false,
      issues: evidenceIssues,
    }
  }

  return {
    success: true,
    data: parsed.data,
  }
}

function validateEvidenceReferences(
  result: EducationalAnalysisResult,
  analysisContext: AnalysisContextPackage,
): EducationalAnalysisValidationIssue[] {
  const allowedMessageIds = allowedEvidenceMessageIds(analysisContext)
  const issues: EducationalAnalysisValidationIssue[] = []

  validateEvidenceArray(
    result.evidenceReferences,
    'evidenceReferences',
    allowedMessageIds,
    issues,
  )
  validateEvidenceArray(
    result.effortEvidence.evidenceMessageIds,
    'effortEvidence.evidenceMessageIds',
    allowedMessageIds,
    issues,
  )
  validateEvidenceArray(
    result.learningEvidence.evidenceMessageIds,
    'learningEvidence.evidenceMessageIds',
    allowedMessageIds,
    issues,
  )

  result.misconceptions.forEach((misconception, index) => {
    validateEvidenceId(
      misconception.evidenceMessageId,
      `misconceptions.${String(index)}.evidenceMessageId`,
      allowedMessageIds,
      issues,
    )
  })

  return issues
}

function allowedEvidenceMessageIds(
  analysisContext: AnalysisContextPackage,
): ReadonlySet<string> {
  const messageIds = new Set<string>()

  addAllowedMessageId(messageIds, analysisContext.studentMessage, {
    activeTopicId: analysisContext.activeTopic.id,
    allowCurrentStudentMessage: true,
  })

  for (const message of analysisContext.selectedHistory) {
    addAllowedMessageId(messageIds, message, {
      activeTopicId: analysisContext.activeTopic.id,
      allowCurrentStudentMessage: false,
    })
  }

  return messageIds
}

function addAllowedMessageId(
  messageIds: Set<string>,
  message: AnalysisContextMessage,
  input: { activeTopicId: string; allowCurrentStudentMessage: boolean },
): void {
  if (input.allowCurrentStudentMessage) {
    if (
      message.role === MessageRole.STUDENT &&
      (message.topicId === null || message.topicId === input.activeTopicId)
    ) {
      messageIds.add(message.id)
    }
    return
  }

  if (
    message.topicId === input.activeTopicId &&
    message.status === MessageStatus.COMPLETED &&
    (message.role === MessageRole.STUDENT ||
      message.role === MessageRole.ASSISTANT)
  ) {
    messageIds.add(message.id)
  }
}

function validateEvidenceArray(
  evidenceMessageIds: readonly string[],
  path: string,
  allowedMessageIds: ReadonlySet<string>,
  issues: EducationalAnalysisValidationIssue[],
): void {
  const seen = new Set<string>()

  evidenceMessageIds.forEach((messageId, index) => {
    const itemPath = `${path}.${String(index)}`
    if (seen.has(messageId)) {
      issues.push({
        category:
          EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_EVIDENCE_REFERENCE,
        path: itemPath,
        message: 'Evidence references must not contain duplicates',
      })
      return
    }
    seen.add(messageId)
    validateEvidenceId(messageId, itemPath, allowedMessageIds, issues)
  })
}

function validateEvidenceId(
  messageId: string,
  path: string,
  allowedMessageIds: ReadonlySet<string>,
  issues: EducationalAnalysisValidationIssue[],
): void {
  if (!allowedMessageIds.has(messageId)) {
    issues.push({
      category:
        EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_EVIDENCE_REFERENCE,
      path,
      message: 'Evidence message ID is not present in the analysis context',
    })
  }
}

function mapZodIssue(
  issue: {
    code: string
    path: PropertyKey[]
    message: string
  },
  raw: unknown,
): EducationalAnalysisValidationIssue {
  return {
    category: mapZodCategory(issue, raw),
    path: formatIssuePath(issue.path),
    message: issue.message,
  }
}

function mapZodCategory(
  issue: {
    code: string
    path: PropertyKey[]
    message: string
  },
  raw: unknown,
): EducationalAnalysisValidationCategory {
  if (!hasValueAtPath(raw, issue.path)) {
    return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MISSING_REQUIRED_FIELD
  }

  switch (issue.code) {
    case 'invalid_type':
      return issue.message.includes('undefined')
        ? EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MISSING_REQUIRED_FIELD
        : EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MALFORMED_INPUT
    case 'invalid_value':
      return enumLikePath(issue.path)
        ? EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_ENUM
        : EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE
    case 'unrecognized_keys':
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.UNKNOWN_FIELD
    case 'too_big':
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.BOUND_EXCEEDED
    case 'too_small':
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_RANGE
    case 'invalid_format':
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE
    case 'custom':
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.INVALID_NESTED_SHAPE
    default:
      return EDUCATIONAL_ANALYSIS_VALIDATION_CATEGORY.MALFORMED_INPUT
  }
}

function enumLikePath(path: readonly PropertyKey[]): boolean {
  const field = path[path.length - 1]
  return (
    field === 'requestKind' ||
    field === 'studentState' ||
    field === 'quality' ||
    field === 'type' ||
    field === 'strength' ||
    field === 'topicRelation' ||
    field === 'recommendedStrategy' ||
    field === 'recommendedTechnique'
  )
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? 'body' : path.map(String).join('.')
}

function hasValueAtPath(value: unknown, path: readonly PropertyKey[]): boolean {
  if (path.length === 0) {
    return value !== undefined
  }

  let current = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return false
    }

    if (!Reflect.has(current, segment)) {
      return false
    }

    current = Reflect.get(current, segment)
  }

  return current !== undefined
}
