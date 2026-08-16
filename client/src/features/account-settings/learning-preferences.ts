import { apiJson } from '@/features/auth/session/interface/authenticated-api-client'

export const ExplanationDetailLevel = {
  CONCISE: 'CONCISE',
  STANDARD: 'STANDARD',
  DETAILED: 'DETAILED',
} as const

export type ExplanationDetailLevel =
  (typeof ExplanationDetailLevel)[keyof typeof ExplanationDetailLevel]

export interface StudentTutoringPreferences {
  explanationDetailLevel: ExplanationDetailLevel
}

export async function getStudentTutoringPreferences(): Promise<StudentTutoringPreferences> {
  return apiJson<StudentTutoringPreferences>(
    '/api/v1/student/tutoring-preferences',
  )
}

export async function updateStudentTutoringPreferences(
  data: StudentTutoringPreferences,
): Promise<StudentTutoringPreferences> {
  return apiJson<StudentTutoringPreferences>(
    '/api/v1/student/tutoring-preferences',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  )
}
