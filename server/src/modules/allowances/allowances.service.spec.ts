import { BadRequestException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

import type { AuditService } from '../audit/audit.public'
import type { AuthenticatedUser } from '../identity/identity.types'
import {
  AllowancesService,
  type UpdateDeploymentDefaultsInput,
  type SetCoursePolicyOverrideInput,
  type CreateAllowanceResetInput,
} from './allowances.service'
import type {
  AllowancesPolicyRepository,
  DeploymentDefaultsRecord,
} from './allowances-policy.repository'

describe('AllowancesService', () => {
  let service: AllowancesService
  let repository: jest.Mocked<AllowancesPolicyRepository>
  let auditService: jest.Mocked<AuditService>
  let configService: jest.Mocked<ConfigService>

  const adminUser: AuthenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@morshid.test',
    displayName: 'Admin User',
    role: 'ADMIN',
    status: 'ACTIVE',
  }

  const defaultPolicy: DeploymentDefaultsRecord = {
    id: 'default',
    tutoringLimit: 30,
    reviewLimit: 3,
    updatedAt: new Date('2026-08-20T00:00:00.000Z'),
  }

  let getDeploymentDefaultsMock: jest.Mock
  let updateDeploymentDefaultsMock: jest.Mock
  let getCourseOverrideMock: jest.Mock
  let listCourseOverridesMock: jest.Mock
  let setCourseOverrideMock: jest.Mock
  let removeCourseOverrideMock: jest.Mock
  let getLatestResetCutoffMock: jest.Mock
  let findStudentByEmailMock: jest.Mock
  let createResetMock: jest.Mock
  let countTutoringTurnsMock: jest.Mock
  let countReviewRequestsMock: jest.Mock
  let recordEventMock: jest.Mock

  beforeEach(() => {
    getDeploymentDefaultsMock = jest.fn().mockResolvedValue(defaultPolicy)
    updateDeploymentDefaultsMock = jest
      .fn()
      .mockImplementation((data: UpdateDeploymentDefaultsInput) =>
        Promise.resolve({
          ...defaultPolicy,
          ...data,
        }),
      )
    getCourseOverrideMock = jest.fn().mockResolvedValue(null)
    listCourseOverridesMock = jest.fn().mockResolvedValue([])
    setCourseOverrideMock = jest
      .fn()
      .mockImplementation(
        (courseId: string, data: SetCoursePolicyOverrideInput) =>
          Promise.resolve({
            id: 'override-1',
            courseId,
            courseCode: 'CS101',
            courseTitle: 'Intro to CS',
            tutoringLimit: data.tutoringLimit ?? null,
            reviewLimit: data.reviewLimit ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      )
    removeCourseOverrideMock = jest.fn().mockResolvedValue(true)
    getLatestResetCutoffMock = jest.fn().mockResolvedValue(null)
    findStudentByEmailMock = jest.fn().mockResolvedValue(null)
    createResetMock = jest
      .fn()
      .mockImplementation(
        (data: CreateAllowanceResetInput & { createdById: string }) =>
          Promise.resolve({
            id: 'reset-1',
            studentId: data.studentId,
            courseId: data.courseId,
            scope: data.scope,
            reason: data.reason,
            createdById: data.createdById,
            createdAt: new Date('2026-08-20T10:00:00.000Z'),
          }),
      )
    countTutoringTurnsMock = jest.fn().mockResolvedValue(0)
    countReviewRequestsMock = jest.fn().mockResolvedValue(0)
    recordEventMock = jest.fn().mockResolvedValue({ id: 'audit-1' })

    repository = {
      getDeploymentDefaults: getDeploymentDefaultsMock,
      updateDeploymentDefaults: updateDeploymentDefaultsMock,
      getCourseOverride: getCourseOverrideMock,
      listCourseOverrides: listCourseOverridesMock,
      setCourseOverride: setCourseOverrideMock,
      removeCourseOverride: removeCourseOverrideMock,
      getLatestResetCutoff: getLatestResetCutoffMock,
      findStudentByEmail: findStudentByEmailMock,
      createReset: createResetMock,
      countTutoringTurns: countTutoringTurnsMock,
      countReviewRequests: countReviewRequestsMock,
    } as unknown as jest.Mocked<AllowancesPolicyRepository>

    auditService = {
      recordEvent: recordEventMock,
    } as unknown as jest.Mocked<AuditService>

    configService = {
      get: jest.fn().mockReturnValue('Africa/Cairo'),
    } as unknown as jest.Mocked<ConfigService>

    service = new AllowancesService(repository, auditService, configService)
  })

  describe('Policy resolution', () => {
    it('uses deployment defaults when no course override exists', async () => {
      const tutoringLimit =
        await service.resolveEffectiveTutoringLimit('course-1')
      const reviewLimit = await service.resolveEffectiveReviewLimit('course-1')

      expect(tutoringLimit).toBe(30)
      expect(reviewLimit).toBe(3)
    })

    it('uses course override limits when present', async () => {
      repository.getCourseOverride.mockResolvedValue({
        id: 'override-1',
        courseId: 'course-1',
        courseCode: 'CS101',
        courseTitle: 'Intro to CS',
        tutoringLimit: 50,
        reviewLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const tutoringLimit =
        await service.resolveEffectiveTutoringLimit('course-1')
      const reviewLimit = await service.resolveEffectiveReviewLimit('course-1')

      expect(tutoringLimit).toBe(50)
      expect(reviewLimit).toBe(5)
    })

    it('allows limit of 0 to disable a capability for a course', async () => {
      repository.getCourseOverride.mockResolvedValue({
        id: 'override-1',
        courseId: 'course-1',
        courseCode: 'CS101',
        courseTitle: 'Intro to CS',
        tutoringLimit: 0,
        reviewLimit: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const tutoringLimit =
        await service.resolveEffectiveTutoringLimit('course-1')
      const reviewLimit = await service.resolveEffectiveReviewLimit('course-1')

      expect(tutoringLimit).toBe(0)
      expect(reviewLimit).toBe(0)
    })

    it('falls back to deployment default for partially overridden course', async () => {
      repository.getCourseOverride.mockResolvedValue({
        id: 'override-1',
        courseId: 'course-1',
        courseCode: 'CS101',
        courseTitle: 'Intro to CS',
        tutoringLimit: 40,
        reviewLimit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const tutoringLimit =
        await service.resolveEffectiveTutoringLimit('course-1')
      const reviewLimit = await service.resolveEffectiveReviewLimit('course-1')

      expect(tutoringLimit).toBe(40)
      expect(reviewLimit).toBe(3)
    })
  })

  describe('Allowance State Calculation', () => {
    it('calculates remaining turns and used turns accurately', async () => {
      countTutoringTurnsMock.mockResolvedValueOnce(12)
      countReviewRequestsMock.mockResolvedValueOnce(2)

      const tutoringState = await service.getTutoringAllowanceState({
        studentId: 'student-1',
        courseId: 'course-1',
        now: new Date('2026-08-20T12:00:00.000Z'),
      })

      expect(tutoringState.limit).toBe(30)
      expect(tutoringState.used).toBe(12)
      expect(tutoringState.remaining).toBe(18)
      expect(tutoringState.policyTimeZone).toBe('Africa/Cairo')

      const reviewState = await service.getReviewAllowanceState({
        studentId: 'student-1',
        courseId: 'course-1',
        now: new Date('2026-08-20T12:00:00.000Z'),
      })

      expect(reviewState.limit).toBe(3)
      expect(reviewState.used).toBe(2)
      expect(reviewState.remaining).toBe(1)
    })

    it('clamps remaining turns to 0 when usage equals or exceeds limit', async () => {
      countTutoringTurnsMock.mockResolvedValueOnce(35)

      const tutoringState = await service.getTutoringAllowanceState({
        studentId: 'student-1',
        courseId: 'course-1',
      })

      expect(tutoringState.limit).toBe(30)
      expect(tutoringState.used).toBe(35)
      expect(tutoringState.remaining).toBe(0)
    })

    it('accounts for allowance reset cutoff', async () => {
      const resetTime = new Date('2026-08-20T10:30:00.000Z')
      getLatestResetCutoffMock.mockResolvedValueOnce(resetTime)
      countTutoringTurnsMock.mockResolvedValueOnce(3)

      const tutoringState = await service.getTutoringAllowanceState({
        studentId: 'student-1',
        courseId: 'course-1',
        now: new Date('2026-08-20T12:00:00.000Z'),
      })

      expect(countTutoringTurnsMock).toHaveBeenCalledWith(
        'student-1',
        'course-1',
        resetTime,
        expect.any(Date),
        undefined,
      )
      expect(tutoringState.used).toBe(3)
      expect(tutoringState.remaining).toBe(27)
      expect(tutoringState.resetCutoff).toEqual(resetTime)
    })
  })

  describe('Admin Operations', () => {
    it('updates deployment defaults and records audit event', async () => {
      const updated = await service.updateDeploymentDefaults(
        { tutoringLimit: 40, reviewLimit: 5 },
        adminUser,
      )

      expect(updateDeploymentDefaultsMock).toHaveBeenCalledWith({
        tutoringLimit: 40,
        reviewLimit: 5,
      })
      expect(updated.tutoringLimit).toBe(40)
      expect(updated.reviewLimit).toBe(5)

      expect(recordEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminUser.id,
          action: 'allowance.policy_defaults_updated',
          target: { type: 'deployment_policy_default', id: 'default' },
        }),
      )
    })

    it('rejects invalid deployment default bounds', async () => {
      await expect(
        service.updateDeploymentDefaults({ tutoringLimit: -1 }, adminUser),
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.updateDeploymentDefaults({ tutoringLimit: 501 }, adminUser),
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.updateDeploymentDefaults({ reviewLimit: 25 }, adminUser),
      ).rejects.toThrow(BadRequestException)
    })

    it('sets course override and records audit event', async () => {
      const override = await service.setCourseOverride(
        'course-1',
        { tutoringLimit: 15 },
        adminUser,
      )

      expect(setCourseOverrideMock).toHaveBeenCalledWith('course-1', {
        tutoringLimit: 15,
      })
      expect(override.courseId).toBe('course-1')

      expect(recordEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminUser.id,
          action: 'allowance.course_override_created',
          courseId: 'course-1',
        }),
      )
    })

    it('deletes course override and records audit event', async () => {
      getCourseOverrideMock.mockResolvedValueOnce({
        id: 'override-1',
        courseId: 'course-1',
        courseCode: 'CS101',
        courseTitle: 'Intro to CS',
        tutoringLimit: 50,
        reviewLimit: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.removeCourseOverride('course-1', adminUser)

      expect(result).toEqual({ success: true })
      expect(removeCourseOverrideMock).toHaveBeenCalledWith('course-1')
      expect(recordEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminUser.id,
          action: 'allowance.course_override_deleted',
          courseId: 'course-1',
        }),
      )
    })

    it('creates an audited allowance reset', async () => {
      const reset = await service.createAllowanceReset(
        {
          studentId: 'student-1',
          courseId: 'course-1',
          scope: 'BOTH',
          reason: 'Student experienced test session timeout bug',
        },
        adminUser,
      )

      expect(createResetMock).toHaveBeenCalledWith({
        studentId: 'student-1',
        courseId: 'course-1',
        scope: 'BOTH',
        reason: 'Student experienced test session timeout bug',
        createdById: adminUser.id,
      })
      expect(reset.id).toBe('reset-1')

      expect(recordEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminUser.id,
          action: 'allowance.reset_created',
          courseId: 'course-1',
          metadata: {
            studentId: 'student-1',
            scope: 'BOTH',
            reason: 'Student experienced test session timeout bug',
          },
        }),
      )
    })

    it('creates an audited allowance reset resolving student by email', async () => {
      findStudentByEmailMock.mockResolvedValueOnce({
        id: 'student-from-email',
        email: 'student@morshid.demo',
        displayName: 'Test Student',
      })

      const reset = await service.createAllowanceReset(
        {
          studentEmail: 'student@morshid.demo',
          courseId: 'course-1',
          scope: 'TUTORING',
          reason: 'Manual test reset',
        },
        adminUser,
      )

      expect(findStudentByEmailMock).toHaveBeenCalledWith(
        'student@morshid.demo',
      )
      expect(createResetMock).toHaveBeenCalledWith({
        studentId: 'student-from-email',
        courseId: 'course-1',
        scope: 'TUTORING',
        reason: 'Manual test reset',
        createdById: adminUser.id,
      })
      expect(reset.id).toBe('reset-1')
    })

    it('rejects allowance reset with blank reason', async () => {
      await expect(
        service.createAllowanceReset(
          {
            studentId: 'student-1',
            courseId: 'course-1',
            scope: 'BOTH',
            reason: '   ',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
