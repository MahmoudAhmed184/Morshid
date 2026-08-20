import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import type {
  AllowancesResolver,
  AllowanceState,
} from '../../allowances/interface/allowances-resolver'
import { StudentTutoringAllowanceController } from './student-tutoring-allowance.controller'

describe('StudentTutoringAllowanceController', () => {
  let controller: StudentTutoringAllowanceController
  let allowancesResolver: jest.Mocked<AllowancesResolver>

  const request = {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'student@morshid.test',
      displayName: 'Student',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  } as unknown as AuthenticatedHttpRequest

  const mockState: AllowanceState = {
    limit: 30,
    used: 5,
    remaining: 25,
    resetAt: new Date('2026-08-20T21:00:00.000Z'),
    policyTimeZone: 'Africa/Cairo',
    resetCutoff: new Date('2026-08-19T21:00:00.000Z'),
    policyDayStart: new Date('2026-08-19T21:00:00.000Z'),
    policyDayEnd: new Date('2026-08-20T21:00:00.000Z'),
  }

  let getTutoringAllowanceStateMock: jest.Mock

  beforeEach(() => {
    getTutoringAllowanceStateMock = jest.fn().mockResolvedValue(mockState)
    allowancesResolver = {
      resolvePolicyDayWindow: jest.fn(),
      resolveEffectiveTutoringLimit: jest.fn(),
      resolveEffectiveReviewLimit: jest.fn(),
      resolveLatestResetCutoff: jest.fn(),
      getTutoringAllowanceState: getTutoringAllowanceStateMock,
      getReviewAllowanceState: jest.fn(),
    }

    controller = new StudentTutoringAllowanceController(allowancesResolver)
  })

  it('returns student tutoring allowance for a course', async () => {
    const courseId = '22222222-2222-4222-8222-222222222222'
    const result = await controller.getAllowance({ courseId }, request)

    expect(getTutoringAllowanceStateMock).toHaveBeenCalledWith({
      studentId: request.user.id,
      courseId,
    })
    expect(result).toEqual({
      limit: 30,
      used: 5,
      remaining: 25,
      resetAt: '2026-08-20T21:00:00.000Z',
      policyTimeZone: 'Africa/Cairo',
    })
  })
})
