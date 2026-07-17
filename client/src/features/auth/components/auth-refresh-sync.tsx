import { useEffect } from 'react'

import { restoreAuthSession } from '@/features/auth/api/authenticated-api-client'

export function AuthRefreshSync() {
  useEffect(() => {
    void restoreAuthSession().catch(() => {
      // Transient startup failures leave the HttpOnly cookie for a later retry.
    })
  }, [])

  return null
}
