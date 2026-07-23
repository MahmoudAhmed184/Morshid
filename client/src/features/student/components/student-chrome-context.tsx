import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/**
 * Control surface the /chat page publishes so the shell-level top-right cluster
 * (T9.2) can render the sources toggle. The frame lives at the student shell so
 * it stays stable across /chat and /settings; only the chat workspace
 * registers a control, and only while a conversation with ≥1 message is mounted
 * (T15.6 — nothing to cite before then) — everywhere else the cluster shows the
 * theme switcher alone.
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
  // T15.7 — the chat page registers the composer's focus handle here so the
  // sidebar's New chat and the collapsed `+` can focus it after entering the
  // draft, even from a different route subtree.
  registerComposerFocus: (focus: () => void) => () => void
  requestComposerFocus: () => void
  // T15.8 — the ⌘K search palette open state, driven from the collapsed search
  // icon and the shell-wide key binding.
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

const StudentChromeContext = createContext<StudentChromeContextValue | null>(
  null,
)

export function StudentChromeProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<SourcesControl | null>(null)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const composerFocusRef = useRef<(() => void) | null>(null)
  const focusRequestedRef = useRef(false)

  const registerComposerFocus = useCallback((focus: () => void) => {
    composerFocusRef.current = focus
    // A focus requested before the composer mounted (e.g. New chat pressed from
    // a conversation) is honoured as soon as the draft composer registers.
    if (focusRequestedRef.current) {
      focusRequestedRef.current = false
      focus()
    }

    return () => {
      if (composerFocusRef.current === focus) {
        composerFocusRef.current = null
      }
    }
  }, [])

  const requestComposerFocus = useCallback(() => {
    if (composerFocusRef.current) {
      composerFocusRef.current()
    } else {
      focusRequestedRef.current = true
    }
  }, [])

  const value = useMemo(
    () => ({
      sources,
      setSources,
      registerComposerFocus,
      requestComposerFocus,
      isSearchOpen,
      setSearchOpen,
    }),
    [sources, registerComposerFocus, requestComposerFocus, isSearchOpen],
  )

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
 * Publish the /chat sources control into the shell cluster while `active`. The
 * chat workspace registers only once a conversation holds ≥1 message (T15.6);
 * the draft and empty conversations pass `active: false` so no toggle appears. A
 * no-op when rendered outside the provider (e.g. unit tests that mount the page
 * in isolation), so the workspace still works and its inline panel stays visible
 * by its own default.
 */
export function useRegisterSourcesControl(
  isOpen: boolean,
  onToggle: () => void,
  onOpenMobile: () => void,
  active: boolean,
) {
  const context = useContext(StudentChromeContext)
  const setSources = context?.setSources

  useEffect(() => {
    if (!setSources) {
      return
    }

    if (!active) {
      setSources(null)
      return
    }

    setSources({ isOpen, onToggle, onOpenMobile })

    return () => setSources(null)
  }, [setSources, active, isOpen, onToggle, onOpenMobile])
}

/**
 * T15.7 — register the composer's focus handle for the lifetime of the caller.
 * A no-op outside the provider. The latest `focus` is always used.
 */
export function useRegisterComposerFocus(focus: () => void) {
  const context = useContext(StudentChromeContext)
  const register = context?.registerComposerFocus
  const focusRef = useRef(focus)

  useEffect(() => {
    focusRef.current = focus
  })

  useEffect(() => {
    if (!register) {
      return
    }

    return register(() => focusRef.current())
  }, [register])
}

/**
 * Shell actions the sidebar and collapsed cluster invoke: focus the draft
 * composer (T15.7) and open the search palette (T15.8). No-ops outside the
 * provider.
 */
export function useStudentChromeActions() {
  const context = useContext(StudentChromeContext)

  return useMemo(
    () => ({
      requestComposerFocus: () => context?.requestComposerFocus(),
      openSearchPalette: () => context?.setSearchOpen(true),
    }),
    [context],
  )
}

/** T15.8 — the search palette open state, for the palette dialog itself. */
export function useStudentSearchPalette() {
  const context = useContext(StudentChromeContext)

  return {
    isOpen: context?.isSearchOpen ?? false,
    setOpen: context?.setSearchOpen ?? (() => undefined),
  }
}
