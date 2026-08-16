import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ChatDraftScope } from './draft-storage'
import { clearDraft, loadDraft, saveDraft } from './draft-storage'

export interface UseComposerDraftOptions {
  userId?: string
  courseId?: string
  sessionId?: string
  draft: string
  setDraft: (text: string) => void
  debounceMs?: number
  storage?: Storage
}

export interface UseComposerDraftResult {
  isRestored: boolean
  storageError: boolean
  dismissRestoredNotice: () => void
  discardDraft: () => void
  clearSavedDraft: () => void
  flushDraft: () => void
}

export function useComposerDraft({
  userId,
  courseId,
  sessionId,
  draft,
  setDraft,
  debounceMs = 500,
  storage,
}: UseComposerDraftOptions): UseComposerDraftResult {
  const [isRestored, setIsRestored] = useState(false)
  const [storageError, setStorageError] = useState(false)

  const scope = useMemo<Partial<ChatDraftScope>>(
    () => ({
      userId,
      courseId,
      sessionId,
    }),
    [userId, courseId, sessionId],
  )

  const draftRef = useRef(draft)
  const scopeRef = useRef(scope)
  const storageRef = useRef(storage)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDraftRef = useRef<string | null>(null)
  const isInitialMountForScopeRef = useRef(true)

  useEffect(() => {
    draftRef.current = draft
    scopeRef.current = scope
    storageRef.current = storage
  })

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  const flushDraft = useCallback(() => {
    clearDebounceTimer()
    const currentScope = scopeRef.current
    const currentText = draftRef.current

    if (lastSavedDraftRef.current === currentText) {
      return
    }

    const result = saveDraft(currentScope, currentText, storageRef.current)
    if (result.success) {
      lastSavedDraftRef.current = currentText
      setStorageError(false)
    } else if (result.error) {
      setStorageError(true)
    }
  }, [clearDebounceTimer])

  const clearSavedDraft = useCallback(() => {
    clearDebounceTimer()
    clearDraft(scopeRef.current, storageRef.current)
    lastSavedDraftRef.current = ''
    setIsRestored(false)
    setStorageError(false)
  }, [clearDebounceTimer])

  const discardDraft = useCallback(() => {
    clearDebounceTimer()
    clearDraft(scopeRef.current, storageRef.current)
    lastSavedDraftRef.current = ''
    setDraft('')
    setIsRestored(false)
    setStorageError(false)
  }, [clearDebounceTimer, setDraft])

  const dismissRestoredNotice = useCallback(() => {
    setIsRestored(false)
  }, [])

  // Restore draft on mount or scope switch (only into an empty composer).
  useEffect(() => {
    clearDebounceTimer()
    isInitialMountForScopeRef.current = true

    if (draftRef.current.trim().length === 0) {
      const savedText = loadDraft(scope, Date.now(), storageRef.current)
      if (savedText && savedText.trim().length > 0) {
        setDraft(savedText)
        lastSavedDraftRef.current = savedText
        setIsRestored(true)
        setStorageError(false)
        return
      }
    }

    lastSavedDraftRef.current = draftRef.current
    setIsRestored(false)
    setStorageError(false)

    return () => {
      // Flush any pending uncommitted changes for previous scope on scope change/unmount.
      flushDraft()
    }
  }, [
    scope.userId,
    scope.courseId,
    scope.sessionId,
    clearDebounceTimer,
    flushDraft,
    setDraft,
    scope,
  ])

  // Debounced autosave on text changes.
  useEffect(() => {
    if (isInitialMountForScopeRef.current) {
      isInitialMountForScopeRef.current = false
      return
    }

    if (draft === lastSavedDraftRef.current) {
      return
    }

    clearDebounceTimer()

    debounceTimerRef.current = setTimeout(() => {
      const currentScope = scopeRef.current
      const result = saveDraft(currentScope, draft, storageRef.current)
      if (result.success) {
        lastSavedDraftRef.current = draft
        setStorageError(false)
      } else if (result.error) {
        setStorageError(true)
      }
    }, debounceMs)

    return () => {
      clearDebounceTimer()
    }
  }, [draft, debounceMs, clearDebounceTimer])

  return {
    isRestored,
    storageError,
    dismissRestoredNotice,
    discardDraft,
    clearSavedDraft,
    flushDraft,
  }
}
