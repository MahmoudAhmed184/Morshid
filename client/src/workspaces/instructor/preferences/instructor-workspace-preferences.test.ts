import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_SAVED_FILTERS,
  getPreferencesStorageKey,
  readInstructorPreferences,
  sanitizeCriteria,
  sanitizeFilterName,
  sanitizeSavedFilters,
  validateFilterName,
  writeInstructorPreferences,
} from './instructor-workspace-preferences.storage'
import type { SavedQueueFilter } from './instructor-workspace-preferences.types'

describe('instructor-workspace-preferences storage', () => {
  const userOneId = 'user-1111-1111'
  const userTwoId = 'user-2222-2222'

  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('User Namespacing', () => {
    it('generates distinct storage keys for different users', () => {
      expect(getPreferencesStorageKey(userOneId)).toBe(
        'morshid:instructor-workspace-preferences:user-1111-1111',
      )
      expect(getPreferencesStorageKey(userTwoId)).toBe(
        'morshid:instructor-workspace-preferences:user-2222-2222',
      )
    })

    it('keeps preferences completely isolated between different users on the same browser', () => {
      writeInstructorPreferences(userOneId, {
        activeCourseId: 'course-alpha',
        savedFilters: [
          {
            id: 'filter-1',
            name: 'Urgent Pending',
            criteria: { status: 'PENDING', trigger: 'STUDENT_REQUEST' },
            createdAt: '2026-08-16T00:00:00.000Z',
          },
        ],
      })

      writeInstructorPreferences(userTwoId, {
        activeCourseId: 'course-beta',
        savedFilters: [
          {
            id: 'filter-2',
            name: 'Resolved Today',
            criteria: { status: 'RESOLVED' },
            createdAt: '2026-08-16T00:00:00.000Z',
          },
        ],
      })

      const userOnePrefs = readInstructorPreferences(userOneId)
      const userTwoPrefs = readInstructorPreferences(userTwoId)

      expect(userOnePrefs.activeCourseId).toBe('course-alpha')
      expect(userOnePrefs.savedFilters).toHaveLength(1)
      expect(userOnePrefs.savedFilters[0].name).toBe('Urgent Pending')

      expect(userTwoPrefs.activeCourseId).toBe('course-beta')
      expect(userTwoPrefs.savedFilters).toHaveLength(1)
      expect(userTwoPrefs.savedFilters[0].name).toBe('Resolved Today')
    })

    it('returns safe fallback when userId is null or undefined', () => {
      expect(readInstructorPreferences(null)).toEqual({
        activeCourseId: null,
        savedFilters: [],
      })
      expect(readInstructorPreferences(undefined)).toEqual({
        activeCourseId: null,
        savedFilters: [],
      })
    })
  })

  describe('Filter Name Validation', () => {
    const existingFilters: SavedQueueFilter[] = [
      {
        id: 'f1',
        name: 'Urgent Reviews',
        criteria: { status: 'PENDING' },
        createdAt: '2026-08-16T00:00:00.000Z',
      },
    ]

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeFilterName('  My Filter  ')).toBe('My Filter')
      const res = validateFilterName('   Clean Name   ', existingFilters)
      expect(res.valid).toBe(true)
      expect(res.trimmedName).toBe('Clean Name')
    })

    it('rejects empty or whitespace-only names', () => {
      const res = validateFilterName('   ', existingFilters)
      expect(res.valid).toBe(false)
      expect(res.error).toBe('Filter name cannot be empty.')
    })

    it('rejects names exceeding 40 characters', () => {
      const longName = 'A'.repeat(41)
      const res = validateFilterName(longName, existingFilters)
      expect(res.valid).toBe(false)
      expect(res.error).toBe('Filter name cannot exceed 40 characters.')
    })

    it('rejects case-insensitive duplicate names', () => {
      const res = validateFilterName('urgent reviews', existingFilters)
      expect(res.valid).toBe(false)
      expect(res.error).toBe('A filter with this name already exists.')
    })

    it('allows keeping the same name when renaming the same filter', () => {
      const res = validateFilterName('Urgent Reviews', existingFilters, 'f1')
      expect(res.valid).toBe(true)
    })
  })

  describe('Max Saved Filters Limit (10)', () => {
    it('enforces maximum 10 filters on sanitize', () => {
      const elevenFilters: SavedQueueFilter[] = Array.from(
        { length: 12 },
        (_, i) => ({
          id: `f-${i}`,
          name: `Preset ${i + 1}`,
          criteria: { status: 'PENDING' as const },
          createdAt: new Date().toISOString(),
        }),
      )

      const sanitized = sanitizeSavedFilters(elevenFilters)
      expect(sanitized).toHaveLength(MAX_SAVED_FILTERS)
      expect(sanitized[0].name).toBe('Preset 1')
      expect(sanitized[9].name).toBe('Preset 10')
    })
  })

  describe('Corrupt and Obsolete Data Recovery', () => {
    it('recovers safely from non-JSON or corrupted localStorage payload', () => {
      window.localStorage.setItem(
        getPreferencesStorageKey(userOneId),
        '{ invalid json !!!',
      )

      const prefs = readInstructorPreferences(userOneId)
      expect(prefs).toEqual({
        activeCourseId: null,
        savedFilters: [],
      })
    })

    it('recovers safely when storage contains non-object data', () => {
      window.localStorage.setItem(
        getPreferencesStorageKey(userOneId),
        JSON.stringify('string-value'),
      )

      const prefs = readInstructorPreferences(userOneId)
      expect(prefs).toEqual({
        activeCourseId: null,
        savedFilters: [],
      })
    })

    it('sanitizes obsolete enum values and triggers gracefully', () => {
      const criteria = sanitizeCriteria({
        status: 'NON_EXISTENT_STATUS',
        trigger: 'UNKNOWN_TRIGGER',
        studentFlagReason: 'INVALID_REASON',
        courseId: 'course-1',
        search: '  search query  ',
      })

      expect(criteria.status).toBeUndefined()
      expect(criteria.trigger).toBeUndefined()
      expect(criteria.studentFlagReason).toBeUndefined()
      expect(criteria.courseId).toBe('course-1')
      expect(criteria.search).toBe('  search query  ')
    })

    it('clears removed course IDs when validating against available courses', () => {
      const availableCourses = ['course-1', 'course-2']

      const criteria = sanitizeCriteria(
        { courseId: 'deleted-course-999', status: 'PENDING' },
        availableCourses,
      )
      expect(criteria.courseId).toBeNull()
      expect(criteria.status).toBe('PENDING')

      const validCriteria = sanitizeCriteria(
        { courseId: 'course-1', status: 'PENDING' },
        availableCourses,
      )
      expect(validCriteria.courseId).toBe('course-1')
    })

    it('drops invalid filter objects during sanitization', () => {
      const badList = [
        null,
        undefined,
        123,
        { id: '', name: 'Empty ID' },
        { id: 'ok-1', name: '' },
        { id: 'ok-2', name: 'Valid Filter', criteria: { status: 'RESOLVED' } },
      ]

      const sanitized = sanitizeSavedFilters(badList)
      expect(sanitized).toHaveLength(1)
      expect(sanitized[0].id).toBe('ok-2')
      expect(sanitized[0].name).toBe('Valid Filter')
      expect(sanitized[0].criteria.status).toBe('RESOLVED')
    })
  })
})
