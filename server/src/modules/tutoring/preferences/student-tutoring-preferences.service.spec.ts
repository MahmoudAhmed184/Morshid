import { ExplanationDetailLevel } from '../tutoring-values'
import { StudentTutoringPreferencesService } from './student-tutoring-preferences.service'
import type { PrismaService } from '../../../platform/database/prisma.service'

describe('StudentTutoringPreferencesService', () => {
  it('returns STANDARD default when no preference record exists', async () => {
    const findUnique = jest.fn().mockResolvedValue(null)
    const prisma = {
      studentTutoringPreference: {
        findUnique,
        upsert: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new StudentTutoringPreferencesService(prisma)
    const result = await service.getPreferences('student-1')

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.STANDARD,
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      select: { explanationDetailLevel: true },
    })
  })

  it('returns stored preference when valid record exists', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.CONCISE,
    })
    const prisma = {
      studentTutoringPreference: {
        findUnique,
        upsert: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new StudentTutoringPreferencesService(prisma)
    const result = await service.getPreferences('student-1')

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.CONCISE,
    })
  })

  it('normalizes invalid stored value to STANDARD', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      explanationDetailLevel: 'INVALID_VALUE',
    })
    const prisma = {
      studentTutoringPreference: {
        findUnique,
        upsert: jest.fn(),
      },
    } as unknown as PrismaService

    const service = new StudentTutoringPreferencesService(prisma)
    const result = await service.getPreferences('student-1')

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.STANDARD,
    })
  })

  it('upserts and returns the updated preference level', async () => {
    const upsert = jest.fn().mockResolvedValue({
      explanationDetailLevel: ExplanationDetailLevel.DETAILED,
    })
    const prisma = {
      studentTutoringPreference: {
        findUnique: jest.fn(),
        upsert,
      },
    } as unknown as PrismaService

    const service = new StudentTutoringPreferencesService(prisma)
    const result = await service.updatePreferences('student-1', {
      explanationDetailLevel: ExplanationDetailLevel.DETAILED,
    })

    expect(result).toEqual({
      explanationDetailLevel: ExplanationDetailLevel.DETAILED,
    })
    expect(upsert).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      create: {
        studentId: 'student-1',
        explanationDetailLevel: ExplanationDetailLevel.DETAILED,
      },
      update: {
        explanationDetailLevel: ExplanationDetailLevel.DETAILED,
      },
      select: { explanationDetailLevel: true },
    })
  })
})
