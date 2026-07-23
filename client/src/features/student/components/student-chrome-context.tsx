import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Control surface the /chat page publishes so the shell-level top-right cluster
 * (T9.2) can render the sources toggle. The frame lives at the student shell so
 * it stays stable across /chat and /settings; only the chat workspace
 * registers a control, and only while a conversation is mounted — everywhere
 * else the cluster shows the theme switcher alone.
 */
export type SourcesControl = {
  /** Whether the desktop (lg+) inline sources panel is expanded. */
  isOpen: boolean
  /** Toggle the desktop inline sources panel. */
  onToggle: () => void
  /** Open the mobile sources Sheet. */
  onOpenMobile: () => void
}

type StudentChromeContextValue = {
  sources: SourcesControl | null
  setSources: (control: SourcesControl | null) => void
}

const StudentChromeContext = createContext<StudentChromeContextValue | null>(
  null,
)

export function StudentChromeProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<SourcesControl | null>(null)
  const value = useMemo(() => ({ sources, setSources }), [sources])

  return (
    <StudentChromeContext.Provider value={value}>
      {children}
    </StudentChromeContext.Provider>
  )
}

/** Read the registered sources control (null when no /chat conversation). */
export function useStudentChromeSources(): SourcesControl | null {
  return useContext(StudentChromeContext)?.sources ?? null
}

/**
 * Publish the /chat sources control into the shell cluster for the lifetime of
 * the calling component. A no-op when rendered outside the provider (e.g. unit
 * tests that mount the page in isolation), so the workspace still works and its
 * inline panel stays visible by its own default.
 */
export function useRegisterSourcesControl(
  isOpen: boolean,
  onToggle: () => void,
  onOpenMobile: () => void,
) {
  const context = useContext(StudentChromeContext)
  const setSources = context?.setSources

  useEffect(() => {
    if (!setSources) {
      return
    }

    setSources({ isOpen, onToggle, onOpenMobile })

    return () => setSources(null)
  }, [setSources, isOpen, onToggle, onOpenMobile])
}
