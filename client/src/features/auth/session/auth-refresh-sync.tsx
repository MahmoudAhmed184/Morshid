import { useEffect, useRef } from 'react'

import { restoreAuthSession } from '@/features/auth/session/interface/authenticated-api-client'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { replaceDocument } from '@/lib/browser/document-navigation'

function isPublicPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  return (
    normalizedPath === '/' ||
    normalizedPath === '/login' ||
    normalizedPath === '/health'
  )
}

export function AuthRefreshSync() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const wasAuthenticatedRef = useRef(isAuthenticated)

  useEffect(() => {
    void restoreAuthSession().catch(() => {
      // Transient startup failures leave the HttpOnly cookie for a later retry.
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (
      wasAuthenticatedRef.current &&
      !isAuthenticated &&
      !isPublicPath(window.location.pathname)
    ) {
      replaceDocument('/login')
    }

    wasAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  return null
}
