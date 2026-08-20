import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import type {
  AllowancesResolver,
  AllowanceState,
} from '../../allowances/interface/allowances-resolver'
import { StudentReviewAllowanceController } from './student-review-allowance.controller'

describe('StudentReviewAllowanceController', () => {
  let controller: StudentReviewAllowanceController
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
    limit: 3,
    used: 1,
    remaining: 2,
    resetAt: new Date('2026-08-20T21:00:00.000Z'),
    policyTimeZone: 'Africa/Cairo',
    resetCutoff: new Date('2026-08-19T21:00:00.000Z'),
    policyDayStart: new Date('2026-08-19T21:00:00.000Z'),
    policyDayEnd: new Date('2026-08-20T21:00:00.000Z'),
  }

  let getReviewAllowanceStateMock: jest.Mock

  beforeEach(() => {
    getReviewAllowanceStateMock = jest.fn().mockResolvedValue(mockState)
    allowancesResolver = {
      resolvePolicyDayWindow: jest.fn(),
      resolveEffectiveTutoringLimit: jest.fn(),
      resolveEffectiveReviewLimit: jest.fn(),
      resolveLatestResetCutoff: jest.fn(),
      getTutoringAllowanceState: jest.fn(),
      getReviewAllowanceState: getReviewAllowanceStateMock,
    }

    controller = new StudentReviewAllowanceController(allowancesResolver)
  })

  it('returns student review allowance for a course', async () => {
    const courseId = '22222222-2222-4222-8222-222222222222'
    const result = await controller.getAllowance({ courseId }, request)

    expect(getReviewAllowanceStateMock).toHaveBeenCalledWith({
      studentId: request.user.id,
      courseId,
    })
    expect(result).toEqual({
      limit: 3,
      used: 1,
      remaining: 2,
      resetAt: '2026-08-20T21:00:00.000Z',
      policyTimeZone: 'Africa/Cairo',
    })
  })
})
