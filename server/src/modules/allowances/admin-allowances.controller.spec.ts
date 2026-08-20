import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { AdminAllowancesController } from './admin-allowances.controller'
import type { AllowancesService } from './allowances.service'

describe('AdminAllowancesController', () => {
  let controller: AdminAllowancesController
  let service: jest.Mocked<AllowancesService>

  const request = {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@morshid.test',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'Jest' },
    get: jest.fn().mockReturnValue('Jest'),
  } as unknown as AuthenticatedHttpRequest

  let getPoliciesMock: jest.Mock
  let updateDeploymentDefaultsMock: jest.Mock
  let setCourseOverrideMock: jest.Mock
  let removeCourseOverrideMock: jest.Mock
  let createAllowanceResetMock: jest.Mock
  let getStudentUsageMock: jest.Mock

  beforeEach(() => {
    getPoliciesMock = jest.fn().mockResolvedValue({
      deploymentDefaults: {
        id: 'default',
        tutoringLimit: 30,
        reviewLimit: 3,
        updatedAt: new Date(),
      },
      courseOverrides: [],
      policyTimeZone: 'Africa/Cairo',
    })
    updateDeploymentDefaultsMock = jest.fn().mockResolvedValue({
      id: 'default',
      tutoringLimit: 40,
      reviewLimit: 5,
      updatedAt: new Date(),
    })
    setCourseOverrideMock = jest.fn().mockResolvedValue({
      id: 'override-1',
      courseId: '22222222-2222-4222-8222-222222222222',
      courseCode: 'CS101',
      courseTitle: 'Intro to CS',
      tutoringLimit: 50,
      reviewLimit: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    removeCourseOverrideMock = jest.fn().mockResolvedValue({ success: true })
    createAllowanceResetMock = jest.fn().mockResolvedValue({
      id: 'reset-1',
      studentId: '33333333-3333-4333-8333-333333333333',
      courseId: '22222222-2222-4222-8222-222222222222',
      scope: 'BOTH',
      reason: 'Reset requested by instructor',
      createdById: request.user.id,
      createdAt: new Date(),
    })
    getStudentUsageMock = jest.fn().mockResolvedValue({
      studentId: '33333333-3333-4333-8333-333333333333',
      courseId: '22222222-2222-4222-8222-222222222222',
      tutoring: {
        limit: 30,
        used: 5,
        remaining: 25,
        resetAt: new Date(),
        policyTimeZone: 'Africa/Cairo',
        resetCutoff: new Date(),
        policyDayStart: new Date(),
        policyDayEnd: new Date(),
      },
      review: {
        limit: 3,
        used: 1,
        remaining: 2,
        resetAt: new Date(),
        policyTimeZone: 'Africa/Cairo',
        resetCutoff: new Date(),
        policyDayStart: new Date(),
        policyDayEnd: new Date(),
      },
    })

    service = {
      getPolicies: getPoliciesMock,
      updateDeploymentDefaults: updateDeploymentDefaultsMock,
      setCourseOverride: setCourseOverrideMock,
      removeCourseOverride: removeCourseOverrideMock,
      createAllowanceReset: createAllowanceResetMock,
      getStudentUsage: getStudentUsageMock,
    } as unknown as jest.Mocked<AllowancesService>

    controller = new AdminAllowancesController(service)
  })

  it('delegates getPolicies to service', async () => {
    const result = await controller.getPolicies()
    expect(getPoliciesMock).toHaveBeenCalledTimes(1)
    expect(result.deploymentDefaults.tutoringLimit).toBe(30)
  })

  it('delegates updateDeploymentDefaults to service', async () => {
    const result = await controller.updateDeploymentDefaults(
      { tutoringLimit: 40, reviewLimit: 5 },
      request,
    )
    expect(updateDeploymentDefaultsMock).toHaveBeenCalledWith(
      { tutoringLimit: 40, reviewLimit: 5 },
      request.user,
      expect.anything(),
    )
    expect(result.tutoringLimit).toBe(40)
  })

  it('delegates setCourseOverride to service', async () => {
    const courseId = '22222222-2222-4222-8222-222222222222'
    const result = await controller.setCourseOverride(
      courseId,
      { tutoringLimit: 50, reviewLimit: 4 },
      request,
    )
    expect(setCourseOverrideMock).toHaveBeenCalledWith(
      courseId,
      { tutoringLimit: 50, reviewLimit: 4 },
      request.user,
      expect.anything(),
    )
    expect(result.tutoringLimit).toBe(50)
  })

  it('delegates removeCourseOverride to service', async () => {
    const courseId = '22222222-2222-4222-8222-222222222222'
    await controller.removeCourseOverride(courseId, request)
    expect(removeCourseOverrideMock).toHaveBeenCalledWith(
      courseId,
      request.user,
      expect.anything(),
    )
  })

  it('delegates createAllowanceReset to service', async () => {
    const body = {
      studentId: '33333333-3333-4333-8333-333333333333',
      courseId: '22222222-2222-4222-8222-222222222222',
      scope: 'BOTH' as const,
      reason: 'Reset requested by instructor',
    }
    const result = await controller.createAllowanceReset(body, request)
    expect(createAllowanceResetMock).toHaveBeenCalledWith(
      body,
      request.user,
      expect.anything(),
    )
    expect(result.id).toBe('reset-1')
  })

  it('delegates getStudentUsage to service', async () => {
    const query = {
      studentId: '33333333-3333-4333-8333-333333333333',
      courseId: '22222222-2222-4222-8222-222222222222',
    }
    const result = await controller.getStudentUsage(query)
    expect(getStudentUsageMock).toHaveBeenCalledWith(
      query.studentId,
      query.courseId,
    )
    expect(result.tutoring.remaining).toBe(25)
  })
})
