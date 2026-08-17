import {
  apiFetch,
  apiJson,
} from '@/features/auth/session/interface/authenticated-api-client'
import { activeSessionListResponseSchema } from './active-sessions.types'
import type { ActiveSession } from './active-sessions.types'

export async function fetchActiveSessions(): Promise<ActiveSession[]> {
  const data = await apiJson<unknown>('/api/v1/auth/sessions')
  const parsed = activeSessionListResponseSchema.parse(data)
  return parsed.sessions
}

export async function revokeActiveSession(familyId: string): Promise<void> {
  await apiFetch(`/api/v1/auth/sessions/${familyId}`, {
    method: 'DELETE',
  })
}

export async function revokeOtherActiveSessions(): Promise<void> {
  await apiFetch('/api/v1/auth/sessions', {
    method: 'DELETE',
  })
}
