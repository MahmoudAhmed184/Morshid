import * as React from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function getMatchMedia() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return (window as Partial<Window>).matchMedia?.bind(window)
}

function getIsMobile() {
  const matchMedia = getMatchMedia()

  return matchMedia?.(MOBILE_MEDIA_QUERY).matches ?? false
}

function getServerSnapshot() {
  return false
}

function subscribe(callback: () => void) {
  const matchMedia = getMatchMedia()

  if (!matchMedia) {
    return () => {}
  }

  const mql = matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener('change', callback)

  return () => mql.removeEventListener('change', callback)
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getIsMobile, getServerSnapshot)
}
