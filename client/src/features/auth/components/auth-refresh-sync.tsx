import { useEffect } from 'react'

import {
  authSessionStorageKey,
  syncAuthRefreshFromStorage,
} from '@/features/auth/stores/auth.store'
import { restoreAuthSession } from '@/lib/api/api-client'

export function AuthRefreshSync() {
  useEffect(() => {
    void restoreAuthSession().catch(() => {
      // Transient startup failures keep the refresh token for a later retry.
    })

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === authSessionStorageKey &&
        event.storageArea === window.localStorage
      ) {
        syncAuthRefreshFromStorage(event.newValue)
      }
    }

    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return null
}
