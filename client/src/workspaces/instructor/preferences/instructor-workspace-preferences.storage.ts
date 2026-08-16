import type {
  InstructorWorkspacePreferences,
  QueueFilterCriteria,
  QueueStatus,
  QueueTrigger,
  SavedQueueFilter,
} from './instructor-workspace-preferences.types'
import type { StudentFlagReason } from '@/features/reviews/interface/instructor-review.schema'
import { studentFlagReasons } from '@/features/reviews/interface/student-flag-reason'

export const MAX_SAVED_FILTERS = 10
export const MAX_FILTER_NAME_LENGTH = 40
export const MIN_FILTER_NAME_LENGTH = 1

export const VALID_QUEUE_STATUSES: readonly QueueStatus[] = [
  'ALL',
  'PENDING',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
]

export const VALID_QUEUE_TRIGGERS: readonly QueueTrigger[] = [
  'STUDENT_REQUEST',
  'GENERAL_NOT_FOUND',
  'CITATION_MISSING',
  'SOURCE_CONFLICT',
  'POLICY_CHECK_FAILED',
  'FINAL_ANSWER_RISK',
]

export function getPreferencesStorageKey(userId: string): string {
  return `morshid:instructor-workspace-preferences:${userId}`
}

export const defaultInstructorWorkspacePreferences: InstructorWorkspacePreferences =
  {
    activeCourseId: null,
    savedFilters: [],
  }

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function sanitizeFilterName(name: string): string {
  return name.trim()
}

export function validateFilterName(
  name: string,
  existingFilters: SavedQueueFilter[],
  excludeFilterId?: string,
): { valid: boolean; error?: string; trimmedName: string } {
  const trimmedName = sanitizeFilterName(name)

  if (trimmedName.length < MIN_FILTER_NAME_LENGTH) {
    return {
      valid: false,
      error: 'Filter name cannot be empty.',
      trimmedName,
    }
  }

  if (trimmedName.length > MAX_FILTER_NAME_LENGTH) {
    return {
      valid: false,
      error: `Filter name cannot exceed ${MAX_FILTER_NAME_LENGTH} characters.`,
      trimmedName,
    }
  }

  const isDuplicate = existingFilters.some(
    (filter) =>
      filter.id !== excludeFilterId &&
      filter.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  )

  if (isDuplicate) {
    return {
      valid: false,
      error: 'A filter with this name already exists.',
      trimmedName,
    }
  }

  return { valid: true, trimmedName }
}

export function sanitizeCriteria(
  criteria: unknown,
  availableCourseIds?: string[],
): QueueFilterCriteria {
  if (typeof criteria !== 'object' || criteria === null) {
    return {}
  }

  const candidate = criteria as Record<string, unknown>
  const result: QueueFilterCriteria = {}

  if (typeof candidate.search === 'string') {
    const trimmed = candidate.search.trim()
    if (trimmed.length > 0) {
      result.search = candidate.search
    }
  }

  if (
    typeof candidate.status === 'string' &&
    VALID_QUEUE_STATUSES.includes(candidate.status as QueueStatus)
  ) {
    result.status = candidate.status as QueueStatus
  }

  if (typeof candidate.courseId === 'string') {
    if (
      !availableCourseIds ||
      availableCourseIds.includes(candidate.courseId)
    ) {
      result.courseId = candidate.courseId
    } else {
      result.courseId = null
    }
  } else if (candidate.courseId === null) {
    result.courseId = null
  }

  if (
    typeof candidate.trigger === 'string' &&
    VALID_QUEUE_TRIGGERS.includes(candidate.trigger as QueueTrigger)
  ) {
    result.trigger = candidate.trigger as QueueTrigger
  } else if (candidate.trigger === null) {
    result.trigger = null
  }

  if (
    typeof candidate.studentFlagReason === 'string' &&
    studentFlagReasons.includes(
      candidate.studentFlagReason as StudentFlagReason,
    )
  ) {
    result.studentFlagReason = candidate.studentFlagReason as StudentFlagReason
  } else if (candidate.studentFlagReason === null) {
    result.studentFlagReason = null
  }

  return result
}

export function sanitizeSavedFilters(
  rawFilters: unknown,
  availableCourseIds?: string[],
): SavedQueueFilter[] {
  if (!Array.isArray(rawFilters)) {
    return []
  }

  const validFilters: SavedQueueFilter[] = []
  const seenNames = new Set<string>()

  for (const item of rawFilters) {
    if (validFilters.length >= MAX_SAVED_FILTERS) {
      break
    }

    if (typeof item !== 'object' || item === null) {
      continue
    }

    const candidate = item as Record<string, unknown>
    const id =
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : null

    const rawName =
      typeof candidate.name === 'string' ? candidate.name.trim() : ''

    if (!id || rawName.length < MIN_FILTER_NAME_LENGTH) {
      continue
    }

    const name =
      rawName.length > MAX_FILTER_NAME_LENGTH
        ? rawName.slice(0, MAX_FILTER_NAME_LENGTH).trim()
        : rawName

    const normalizedName = name.toLowerCase()
    if (seenNames.has(normalizedName)) {
      continue
    }
    seenNames.add(normalizedName)

    const criteria = sanitizeCriteria(candidate.criteria, availableCourseIds)
    const createdAt =
      typeof candidate.createdAt === 'string' &&
      !Number.isNaN(Date.parse(candidate.createdAt))
        ? candidate.createdAt
        : new Date().toISOString()

    const updatedAt =
      typeof candidate.updatedAt === 'string' &&
      !Number.isNaN(Date.parse(candidate.updatedAt))
        ? candidate.updatedAt
        : undefined

    validFilters.push({
      id,
      name,
      criteria,
      createdAt,
      updatedAt,
    })
  }

  return validFilters
}

export function readInstructorPreferences(
  userId: string | null | undefined,
  availableCourseIds?: string[],
): InstructorWorkspacePreferences {
  if (!userId) {
    return defaultInstructorWorkspacePreferences
  }

  const storage = getBrowserStorage()
  if (!storage) {
    return defaultInstructorWorkspacePreferences
  }

  try {
    const raw = storage.getItem(getPreferencesStorageKey(userId))
    if (!raw) {
      return defaultInstructorWorkspacePreferences
    }

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultInstructorWorkspacePreferences
    }

    const candidate = parsed as Record<string, unknown>
    let activeCourseId: string | null = null

    if (typeof candidate.activeCourseId === 'string') {
      if (
        !availableCourseIds ||
        availableCourseIds.includes(candidate.activeCourseId)
      ) {
        activeCourseId = candidate.activeCourseId
      }
    }

    const savedFilters = sanitizeSavedFilters(
      candidate.savedFilters,
      availableCourseIds,
    )

    return {
      activeCourseId,
      savedFilters,
    }
  } catch {
    return defaultInstructorWorkspacePreferences
  }
}

export function writeInstructorPreferences(
  userId: string | null | undefined,
  preferences: InstructorWorkspacePreferences,
): void {
  if (!userId) {
    return
  }

  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  try {
    const sanitizedFilters = sanitizeSavedFilters(preferences.savedFilters)
    const payload: InstructorWorkspacePreferences = {
      activeCourseId: preferences.activeCourseId,
      savedFilters: sanitizedFilters,
    }
    storage.setItem(getPreferencesStorageKey(userId), JSON.stringify(payload))
  } catch {
    // Storage failure (e.g. quota or blocked storage) must not crash the application.
  }
}
