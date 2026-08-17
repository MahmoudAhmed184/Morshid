import { ExplanationDetailLevel } from '../tutoring-values'
import { StudentTutoringPreferencesController } from './student-tutoring-preferences.controller'
import type { StudentTutoringPreferencesService } from './student-tutoring-preferences.service'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { UserRole } from '../../identity/identity.roles'

describe('StudentTutoringPreferencesController', () => {
  const request: AuthenticatedHttpRequest = {
    user: {
      id: 'student-uuid-1',
      email: 'student@morshid.demo',
      displayName: 'Student One',
      role: UserRole.STUDENT,
      status: 'ACTIVE',
    },
  } as AuthenticatedHttpRequest

  it('delegates GET to service with authenticated student ID', async () => {
    const getPreferences = jest.fn().mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.STANDARD,
    })
    const service: Partial<StudentTutoringPreferencesService> = {
      getPreferences,
    }
    const controller = new StudentTutoringPreferencesController(
      service as StudentTutoringPreferencesService,
    )

    const result = await controller.getPreferences(request)

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.STANDARD,
    })
    expect(getPreferences).toHaveBeenCalledWith('student-uuid-1')
  })

  it('delegates PATCH to service with authenticated student ID and body', async () => {
    const updatePreferences = jest.fn().mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.CONCISE,
    })
    const service: Partial<StudentTutoringPreferencesService> = {
      updatePreferences,
    }
    const controller = new StudentTutoringPreferencesController(
      service as StudentTutoringPreferencesService,
    )

    const result = await controller.updatePreferences(
      { explanationDetailLevel: ExplanationDetailLevel.CONCISE },
      request,
    )

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.CONCISE,
    })
    expect(updatePreferences).toHaveBeenCalledWith('student-uuid-1', {
      explanationDetailLevel: ExplanationDetailLevel.CONCISE,
    })
  })
})
