import { vi } from 'vitest'

/**
 * Reports every media query as matching, which covers both the
 * `(prefers-reduced-motion)` query Motion uses and the
 * `(prefers-reduced-motion: reduce)` query the CSS-driven components use.
 *
 * Call `vi.unstubAllGlobals()` in an `afterEach` to restore `matchMedia`.
 */
export function stubReducedMotionPreference() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}
