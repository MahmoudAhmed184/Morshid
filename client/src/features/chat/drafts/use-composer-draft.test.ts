import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatDraftScope } from './draft-storage'
import { createDraftStorageKey, saveDraft } from './draft-storage'
import { useComposerDraft } from './use-composer-draft'

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

describe('useComposerDraft', () => {
  let mockStorage: Storage
  const scope: ChatDraftScope = {
    userId: 'user-1',
    courseId: 'course-1',
    sessionId: 'session-1',
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockStorage = createMockStorage()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores a saved draft on mount when composer is empty', () => {
    saveDraft(scope, 'Saved question text', mockStorage)

    let draftValue = ''
    const setDraftMock = vi.fn((text: string) => {
      draftValue = text
    })

    const { result } = renderHook(() =>
      useComposerDraft({
        userId: scope.userId,
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        draft: draftValue,
        setDraft: setDraftMock,
        storage: mockStorage,
      }),
    )

    expect(setDraftMock).toHaveBeenCalledWith('Saved question text')
    expect(result.current.isRestored).toBe(true)
  })

  it('does not restore saved draft when composer is already non-empty', () => {
    saveDraft(scope, 'Saved question text', mockStorage)

    let draftValue = 'Already typed something'
    const setDraftMock = vi.fn((text: string) => {
      draftValue = text
    })

    const { result } = renderHook(() =>
      useComposerDraft({
        userId: scope.userId,
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        draft: draftValue,
        setDraft: setDraftMock,
        storage: mockStorage,
      }),
    )

    expect(setDraftMock).not.toHaveBeenCalled()
    expect(result.current.isRestored).toBe(false)
  })

  it('debounces saving text changes to storage', () => {
    const setDraftMock = vi.fn()

    const { rerender } = renderHook(
      ({ draft }) =>
        useComposerDraft({
          userId: scope.userId,
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          draft,
          setDraft: setDraftMock,
          debounceMs: 300,
          storage: mockStorage,
        }),
      { initialProps: { draft: '' } },
    )

    // User types 'First word'
    rerender({ draft: 'First word' })
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()

    // Advance halfway
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(150)
    })

    const storedRaw = mockStorage.getItem(createDraftStorageKey(scope))
    expect(storedRaw).toBeTruthy()
    expect(JSON.parse(storedRaw!).text).toBe('First word')
  })

  it('discards draft and clears both state and storage', () => {
    saveDraft(scope, 'Draft to discard', mockStorage)

    let currentDraft = 'Draft to discard'
    const setDraftMock = vi.fn((text: string) => {
      currentDraft = text
    })

    const { result } = renderHook(() =>
      useComposerDraft({
        userId: scope.userId,
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        draft: currentDraft,
        setDraft: setDraftMock,
        storage: mockStorage,
      }),
    )

    act(() => {
      result.current.discardDraft()
    })

    expect(setDraftMock).toHaveBeenCalledWith('')
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
    expect(result.current.isRestored).toBe(false)
  })

  it('clears saved draft upon successful message acceptance without clearing composer text', () => {
    saveDraft(scope, 'Draft sent', mockStorage)

    const setDraftMock = vi.fn()

    const { result } = renderHook(() =>
      useComposerDraft({
        userId: scope.userId,
        courseId: scope.courseId,
        sessionId: scope.sessionId,
        draft: 'Draft sent',
        setDraft: setDraftMock,
        storage: mockStorage,
      }),
    )

    act(() => {
      result.current.clearSavedDraft()
    })

    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
    expect(result.current.isRestored).toBe(false)
  })

  it('flushes unsaved draft on unmount or scope switch', () => {
    const setDraftMock = vi.fn()

    const { rerender, unmount } = renderHook(
      ({ draft, sessionId }) =>
        useComposerDraft({
          userId: scope.userId,
          courseId: scope.courseId,
          sessionId,
          draft,
          setDraft: setDraftMock,
          debounceMs: 500,
          storage: mockStorage,
        }),
      { initialProps: { draft: '', sessionId: 'session-1' } },
    )

    // User types before switching
    rerender({ draft: 'Typed right before navigating', sessionId: 'session-1' })

    // Unmount before debounce timer expires
    unmount()

    const storedRaw = mockStorage.getItem(createDraftStorageKey(scope))
    expect(storedRaw).toBeTruthy()
    expect(JSON.parse(storedRaw!).text).toBe('Typed right before navigating')
  })

  it('sets storageError when storage fails and recovers on successful save', () => {
    const failingStorage = createMockStorage()
    let shouldFail = true
    failingStorage.setItem = (key: string, value: string) => {
      if (shouldFail) {
        throw new Error('Storage failure')
      }
      mockStorage.setItem(key, value)
    }

    const setDraftMock = vi.fn()

    const { result, rerender } = renderHook(
      ({ draft }) =>
        useComposerDraft({
          userId: scope.userId,
          courseId: scope.courseId,
          sessionId: scope.sessionId,
          draft,
          setDraft: setDraftMock,
          debounceMs: 100,
          storage: failingStorage,
        }),
      { initialProps: { draft: '' } },
    )

    rerender({ draft: 'Text that fails to persist' })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.storageError).toBe(true)

    // Recover
    shouldFail = false
    rerender({ draft: 'Text that now persists' })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current.storageError).toBe(false)
  })
})
