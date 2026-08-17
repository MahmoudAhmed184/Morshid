import { z } from 'zod'

export const DRAFT_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const DRAFT_STORAGE_PREFIX = 'morshid:draft:'

export interface ChatDraftScope {
  userId: string
  courseId: string
  sessionId: string
}

export const storedDraftRecordSchema = z.object({
  version: z.literal(1),
  userId: z.string().min(1),
  courseId: z.string().min(1),
  sessionId: z.string().min(1),
  text: z.string(),
  updatedAt: z.number().int().positive(),
})

export type StoredDraftRecord = z.infer<typeof storedDraftRecordSchema>

export function createDraftStorageKey(scope: ChatDraftScope): string {
  return `${DRAFT_STORAGE_PREFIX}${scope.userId}:${scope.courseId}:${scope.sessionId}`
}

function resolveStorage(customStorage?: Storage): Storage | null {
  if (customStorage) {
    return customStorage
  }
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isValidScope(scope: Partial<ChatDraftScope>): scope is ChatDraftScope {
  return Boolean(
    scope.userId &&
    scope.courseId &&
    scope.sessionId &&
    scope.userId.trim().length > 0 &&
    scope.courseId.trim().length > 0 &&
    scope.sessionId.trim().length > 0,
  )
}

export interface SaveDraftResult {
  success: boolean
  error?: unknown
}

export function saveDraft(
  scope: Partial<ChatDraftScope>,
  text: string,
  storage?: Storage,
): SaveDraftResult {
  if (!isValidScope(scope)) {
    return { success: false }
  }

  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return { success: false, error: new Error('Storage is not available') }
  }

  const key = createDraftStorageKey(scope)

  // Empty or whitespace-only draft should clear any saved entry.
  if (text.trim().length === 0) {
    clearDraft(scope, targetStorage)
    return { success: true }
  }

  const record: StoredDraftRecord = {
    version: 1,
    userId: scope.userId,
    courseId: scope.courseId,
    sessionId: scope.sessionId,
    text,
    updatedAt: Date.now(),
  }

  try {
    targetStorage.setItem(key, JSON.stringify(record))
    // Opportunistically clean up expired records on save.
    cleanupExpiredDrafts(record.updatedAt, targetStorage)
    return { success: true }
  } catch (error) {
    // If setting fails (e.g. QuotaExceededError), try cleanup first and retry once.
    try {
      cleanupExpiredDrafts(record.updatedAt, targetStorage)
      targetStorage.setItem(key, JSON.stringify(record))
      return { success: true }
    } catch (retryError) {
      return { success: false, error: retryError ?? error }
    }
  }
}

export function loadDraft(
  scope: Partial<ChatDraftScope>,
  now: number = Date.now(),
  storage?: Storage,
): string | null {
  if (!isValidScope(scope)) {
    return null
  }

  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return null
  }

  const key = createDraftStorageKey(scope)

  let rawValue: string | null = null
  try {
    rawValue = targetStorage.getItem(key)
  } catch {
    return null
  }

  if (rawValue === null) {
    return null
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawValue)
  } catch {
    // Corrupt JSON: remove invalid record.
    safeRemoveItem(targetStorage, key)
    return null
  }

  const parsed = storedDraftRecordSchema.safeParse(parsedJson)
  if (!parsed.success) {
    // Schema mismatch or unsupported version: remove invalid record.
    safeRemoveItem(targetStorage, key)
    return null
  }

  const record = parsed.data

  // Verify scope match to ensure zero cross-user/scope leaks.
  if (
    record.userId !== scope.userId ||
    record.courseId !== scope.courseId ||
    record.sessionId !== scope.sessionId
  ) {
    safeRemoveItem(targetStorage, key)
    return null
  }

  // 30-day expiration check (also discard extreme future clock drift).
  const isExpired = now - record.updatedAt > DRAFT_EXPIRATION_MS
  const isFutureSkewed = record.updatedAt > now + 60_000

  if (isExpired || isFutureSkewed) {
    safeRemoveItem(targetStorage, key)
    return null
  }

  return record.text
}

export function clearDraft(
  scope: Partial<ChatDraftScope>,
  storage?: Storage,
): void {
  if (!isValidScope(scope)) {
    return
  }

  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return
  }

  const key = createDraftStorageKey(scope)
  safeRemoveItem(targetStorage, key)
}

export function cleanupExpiredDrafts(
  now: number = Date.now(),
  storage?: Storage,
): number {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return 0
  }

  let cleanedCount = 0
  const keysToInspect: string[] = []

  try {
    for (let index = 0; index < targetStorage.length; index += 1) {
      const key = targetStorage.key(index)
      if (key && key.startsWith(DRAFT_STORAGE_PREFIX)) {
        keysToInspect.push(key)
      }
    }
  } catch {
    return 0
  }

  for (const key of keysToInspect) {
    try {
      const rawValue = targetStorage.getItem(key)
      if (rawValue === null) {
        continue
      }

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(rawValue)
      } catch {
        safeRemoveItem(targetStorage, key)
        cleanedCount += 1
        continue
      }

      const parsed = storedDraftRecordSchema.safeParse(parsedJson)
      if (!parsed.success) {
        safeRemoveItem(targetStorage, key)
        cleanedCount += 1
        continue
      }

      const record = parsed.data
      const isExpired = now - record.updatedAt > DRAFT_EXPIRATION_MS
      const isFutureSkewed = record.updatedAt > now + 60_000

      if (isExpired || isFutureSkewed) {
        safeRemoveItem(targetStorage, key)
        cleanedCount += 1
      }
    } catch {
      // Ignore individual read/delete errors during opportunistic cleanup.
    }
  }

  return cleanedCount
}

function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore storage removal errors.
  }
}
