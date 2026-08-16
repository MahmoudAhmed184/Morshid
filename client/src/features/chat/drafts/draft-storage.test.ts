import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatDraftScope } from './draft-storage'
import {
  clearDraft,
  cleanupExpiredDrafts,
  createDraftStorageKey,
  DRAFT_EXPIRATION_MS,
  DRAFT_STORAGE_PREFIX,
  loadDraft,
  saveDraft,
} from './draft-storage'

function createMockStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('draft-storage', () => {
  let mockStorage: Storage
  const scope: ChatDraftScope = {
    userId: 'user-1',
    courseId: 'course-1',
    sessionId: 'session-1',
  }

  beforeEach(() => {
    mockStorage = createMockStorage()
  })

  describe('createDraftStorageKey', () => {
    it('creates a namespaced key from userId, courseId, and sessionId', () => {
      const key = createDraftStorageKey(scope)
      expect(key).toBe('morshid:draft:user-1:course-1:session-1')
    })
  })

  describe('saveDraft', () => {
    it('saves a draft with version and timestamp', () => {
      const result = saveDraft(scope, 'Hello world', mockStorage)
      expect(result.success).toBe(true)

      const raw = mockStorage.getItem(createDraftStorageKey(scope))
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw!)
      expect(parsed).toEqual({
        version: 1,
        userId: 'user-1',
        courseId: 'course-1',
        sessionId: 'session-1',
        text: 'Hello world',
        updatedAt: expect.any(Number),
      })
    })

    it('clears draft when saving an empty or whitespace-only string', () => {
      saveDraft(scope, 'Initial draft', mockStorage)
      expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeTruthy()

      const result = saveDraft(scope, '   \n  ', mockStorage)
      expect(result.success).toBe(true)
      expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
    })

    it('returns failure when scope is missing userId, courseId, or sessionId', () => {
      expect(
        saveDraft({ courseId: 'c1', sessionId: 's1' }, 'text', mockStorage)
          .success,
      ).toBe(false)
      expect(
        saveDraft({ userId: 'u1', sessionId: 's1' }, 'text', mockStorage)
          .success,
      ).toBe(false)
      expect(
        saveDraft({ userId: 'u1', courseId: 'c1' }, 'text', mockStorage)
          .success,
      ).toBe(false)
      expect(
        saveDraft(
          { userId: '   ', courseId: 'c1', sessionId: 's1' },
          'text',
          mockStorage,
        ).success,
      ).toBe(false)
    })

    it('handles storage quota exceeded gracefully', () => {
      const failingStorage = createMockStorage()
      failingStorage.setItem = () => {
        throw new Error('QuotaExceededError')
      }

      const result = saveDraft(scope, 'Text', failingStorage)
      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })
  })

  describe('loadDraft', () => {
    it('loads a previously saved draft', () => {
      saveDraft(scope, 'My draft text', mockStorage)
      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBe('My draft text')
    })

    it('returns null when no draft exists', () => {
      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
    })

    it('returns null when scope is invalid', () => {
      saveDraft(scope, 'Draft', mockStorage)
      expect(
        loadDraft({ courseId: 'c1', sessionId: 's1' }, Date.now(), mockStorage),
      ).toBeNull()
    })

    it('removes and ignores corrupted JSON', () => {
      const key = createDraftStorageKey(scope)
      mockStorage.setItem(key, '{not-valid-json')

      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
      expect(mockStorage.getItem(key)).toBeNull()
    })

    it('removes and ignores invalid schema or unsupported version', () => {
      const key = createDraftStorageKey(scope)
      mockStorage.setItem(
        key,
        JSON.stringify({
          version: 2,
          text: 'Unsupported version',
          updatedAt: Date.now(),
        }),
      )

      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
      expect(mockStorage.getItem(key)).toBeNull()
    })

    it('removes and ignores records where stored scope does not match key scope', () => {
      const key = createDraftStorageKey(scope)
      mockStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          userId: 'attacker-user',
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          text: 'Leaked draft',
          updatedAt: Date.now(),
        }),
      )

      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
      expect(mockStorage.getItem(key)).toBeNull()
    })

    it('expires and removes drafts older than 30 days', () => {
      const key = createDraftStorageKey(scope)
      const thirtyOneDaysAgo = Date.now() - (DRAFT_EXPIRATION_MS + 1000)

      mockStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          userId: scope.userId,
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          text: 'Old draft',
          updatedAt: thirtyOneDaysAgo,
        }),
      )

      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
      expect(mockStorage.getItem(key)).toBeNull()
    })

    it('removes and ignores drafts with extreme future timestamps', () => {
      const key = createDraftStorageKey(scope)
      const farFuture = Date.now() + 10 * 60 * 1000 // 10 minutes in future

      mockStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          userId: scope.userId,
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          text: 'Future draft',
          updatedAt: farFuture,
        }),
      )

      const loaded = loadDraft(scope, Date.now(), mockStorage)
      expect(loaded).toBeNull()
      expect(mockStorage.getItem(key)).toBeNull()
    })
  })

  describe('clearDraft', () => {
    it('removes stored draft for given scope', () => {
      saveDraft(scope, 'Text to clear', mockStorage)
      expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeTruthy()

      clearDraft(scope, mockStorage)
      expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
    })

    it('ignores invalid scope without error', () => {
      expect(() => clearDraft({ userId: '' }, mockStorage)).not.toThrow()
    })
  })

  describe('cleanupExpiredDrafts', () => {
    it('removes expired and corrupt draft records while preserving valid active drafts', () => {
      const now = Date.now()
      const validScope: ChatDraftScope = {
        userId: 'u1',
        courseId: 'c1',
        sessionId: 's1',
      }
      const expiredScope: ChatDraftScope = {
        userId: 'u2',
        courseId: 'c1',
        sessionId: 's2',
      }
      const otherAppKey = 'morshid:theme:mode'

      saveDraft(validScope, 'Active text', mockStorage)

      // Set expired item directly
      mockStorage.setItem(
        createDraftStorageKey(expiredScope),
        JSON.stringify({
          version: 1,
          userId: 'u2',
          courseId: 'c1',
          sessionId: 's2',
          text: 'Expired text',
          updatedAt: now - (DRAFT_EXPIRATION_MS + 5000),
        }),
      )

      // Set corrupt draft item directly
      mockStorage.setItem(`${DRAFT_STORAGE_PREFIX}corrupt:key`, 'invalid-json')

      // Set unrelated key
      mockStorage.setItem(otherAppKey, 'dark')

      const cleaned = cleanupExpiredDrafts(now, mockStorage)
      expect(cleaned).toBe(2)

      expect(loadDraft(validScope, now, mockStorage)).toBe('Active text')
      expect(
        mockStorage.getItem(createDraftStorageKey(expiredScope)),
      ).toBeNull()
      expect(
        mockStorage.getItem(`${DRAFT_STORAGE_PREFIX}corrupt:key`),
      ).toBeNull()
      expect(mockStorage.getItem(otherAppKey)).toBe('dark')
    })
  })

  describe('cross-user and cross-scope isolation', () => {
    it('ensures zero cross-user draft leaks on shared devices', () => {
      const userA: ChatDraftScope = {
        userId: 'alice',
        courseId: 'python',
        sessionId: 'new',
      }
      const userB: ChatDraftScope = {
        userId: 'bob',
        courseId: 'python',
        sessionId: 'new',
      }

      saveDraft(userA, 'Alice private notes', mockStorage)
      expect(loadDraft(userB, Date.now(), mockStorage)).toBeNull()

      saveDraft(userB, 'Bob private notes', mockStorage)
      expect(loadDraft(userA, Date.now(), mockStorage)).toBe(
        'Alice private notes',
      )
      expect(loadDraft(userB, Date.now(), mockStorage)).toBe(
        'Bob private notes',
      )
    })

    it('isolates different courses and sessions for the same user', () => {
      const course1New: ChatDraftScope = {
        userId: 'alice',
        courseId: 'course-1',
        sessionId: 'new',
      }
      const course2New: ChatDraftScope = {
        userId: 'alice',
        courseId: 'course-2',
        sessionId: 'new',
      }
      const course1SessionA: ChatDraftScope = {
        userId: 'alice',
        courseId: 'course-1',
        sessionId: 'session-a',
      }

      saveDraft(course1New, 'Course 1 New chat draft', mockStorage)
      saveDraft(course2New, 'Course 2 New chat draft', mockStorage)
      saveDraft(course1SessionA, 'Course 1 Session A draft', mockStorage)

      expect(loadDraft(course1New, Date.now(), mockStorage)).toBe(
        'Course 1 New chat draft',
      )
      expect(loadDraft(course2New, Date.now(), mockStorage)).toBe(
        'Course 2 New chat draft',
      )
      expect(loadDraft(course1SessionA, Date.now(), mockStorage)).toBe(
        'Course 1 Session A draft',
      )

      clearDraft(course1New, mockStorage)
      expect(loadDraft(course1New, Date.now(), mockStorage)).toBeNull()
      expect(loadDraft(course2New, Date.now(), mockStorage)).toBe(
        'Course 2 New chat draft',
      )
      expect(loadDraft(course1SessionA, Date.now(), mockStorage)).toBe(
        'Course 1 Session A draft',
      )
    })
  })
})
