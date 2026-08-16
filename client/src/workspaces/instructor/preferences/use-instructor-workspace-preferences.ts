import { useCallback, useState } from 'react'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type {
  InstructorWorkspacePreferences,
  QueueFilterCriteria,
  SavedQueueFilter,
} from '@/workspaces/instructor/preferences/instructor-workspace-preferences.types'
import {
  MAX_SAVED_FILTERS,
  readInstructorPreferences,
  validateFilterName,
  writeInstructorPreferences,
} from '@/workspaces/instructor/preferences/instructor-workspace-preferences.storage'

export interface SaveFilterResult {
  success: boolean
  error?: string
  filter?: SavedQueueFilter
}

export interface RenameFilterResult {
  success: boolean
  error?: string
}

export function useInstructorWorkspacePreferences() {
  const userId = useAuthStore((state) => state.user?.id)

  const [prevUserId, setPrevUserId] = useState(userId)
  const [preferences, setPreferences] =
    useState<InstructorWorkspacePreferences>(() =>
      readInstructorPreferences(userId),
    )

  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setPreferences(readInstructorPreferences(userId))
  }

  const setActiveCourseId = useCallback(
    (courseId: string | null) => {
      setPreferences((current) => {
        const next: InstructorWorkspacePreferences = {
          ...current,
          activeCourseId: courseId,
        }
        writeInstructorPreferences(userId, next)
        return next
      })
    },
    [userId],
  )

  const resolveActiveCourse = useCallback(
    <T extends { id: string }>(availableCourses: readonly T[]): T | null => {
      if (availableCourses.length === 0) {
        return null
      }

      const match = availableCourses.find(
        (course) => course.id === preferences.activeCourseId,
      )

      if (match) {
        return match
      }

      // Fallback to deterministic first course
      const fallback = availableCourses[0]

      // Clean up stale or unset stored course ID asynchronously to avoid render-phase side effects
      if (preferences.activeCourseId !== null) {
        queueMicrotask(() => {
          setPreferences((current) => {
            if (current.activeCourseId === null) return current
            const next: InstructorWorkspacePreferences = {
              ...current,
              activeCourseId: null,
            }
            writeInstructorPreferences(userId, next)
            return next
          })
        })
      }

      return fallback
    },
    [preferences.activeCourseId, userId],
  )

  const saveFilter = useCallback(
    (name: string, criteria: QueueFilterCriteria): SaveFilterResult => {
      if (preferences.savedFilters.length >= MAX_SAVED_FILTERS) {
        return {
          success: false,
          error: `You have reached the limit of ${MAX_SAVED_FILTERS} saved filters. Delete one before saving a new one.`,
        }
      }

      const validation = validateFilterName(name, preferences.savedFilters)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        }
      }

      const newFilter: SavedQueueFilter = {
        id: crypto.randomUUID(),
        name: validation.trimmedName,
        criteria,
        createdAt: new Date().toISOString(),
      }

      setPreferences((current) => {
        const next: InstructorWorkspacePreferences = {
          ...current,
          savedFilters: [newFilter, ...current.savedFilters],
        }
        writeInstructorPreferences(userId, next)
        return next
      })

      return {
        success: true,
        filter: newFilter,
      }
    },
    [preferences.savedFilters, userId],
  )

  const renameFilter = useCallback(
    (filterId: string, newName: string): RenameFilterResult => {
      const validation = validateFilterName(
        newName,
        preferences.savedFilters,
        filterId,
      )
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        }
      }

      setPreferences((current) => {
        const next: InstructorWorkspacePreferences = {
          ...current,
          savedFilters: current.savedFilters.map((filter) =>
            filter.id === filterId
              ? {
                  ...filter,
                  name: validation.trimmedName,
                  updatedAt: new Date().toISOString(),
                }
              : filter,
          ),
        }
        writeInstructorPreferences(userId, next)
        return next
      })

      return { success: true }
    },
    [preferences.savedFilters, userId],
  )

  const deleteFilter = useCallback(
    (filterId: string) => {
      setPreferences((current) => {
        const next: InstructorWorkspacePreferences = {
          ...current,
          savedFilters: current.savedFilters.filter(
            (filter) => filter.id !== filterId,
          ),
        }
        writeInstructorPreferences(userId, next)
        return next
      })
    },
    [userId],
  )

  return {
    activeCourseId: preferences.activeCourseId,
    savedFilters: preferences.savedFilters,
    setActiveCourseId,
    resolveActiveCourse,
    saveFilter,
    renameFilter,
    deleteFilter,
  }
}
