import { describe, expect, it } from 'vitest'

import {
  createUniversityFormSchema,
  universityItemSchema,
  universityListResponseSchema,
  universitySortFieldSchema,
  updateUniversityFormSchema,
  updateUniversityStatusFormSchema,
} from './universities.schema'

describe('universities.schema', () => {
  const sampleUniversity = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'King Fahd University of Petroleum and Minerals',
    code: 'KFUPM',
    status: 'ACTIVE',
    owner: {
      id: '00000000-0000-4000-8000-000000000002',
      displayName: 'KFUPM Admin',
      email: 'admin@kfupm.edu.sa',
      status: 'ACTIVE',
    },
    studentsCount: 1500,
    instructorsCount: 85,
    coursesCount: 32,
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
  }

  it('parses a valid university item', () => {
    const result = universityItemSchema.safeParse(sampleUniversity)
    expect(result.success).toBe(true)
  })

  it('parses a university list response', () => {
    const response = {
      data: [sampleUniversity],
      pagination: {
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
      },
    }

    const result = universityListResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('validates createUniversityFormSchema and normalizes code/email', () => {
    const input = {
      name: 'Princess Nourah University',
      code: 'pnu_riyadh',
      status: 'ACTIVE' as const,
      ownerDisplayName: 'PNU Administrator',
      ownerEmail: 'Admin@PNU.edu.sa',
      ownerPassword: 'VeryStrongPassword123!',
    }

    const parsed = createUniversityFormSchema.parse(input)
    expect(parsed.code).toBe('PNU_RIYADH')
    expect(parsed.ownerEmail).toBe('admin@pnu.edu.sa')
  })

  it('rejects short passwords in createUniversityFormSchema', () => {
    const input = {
      name: 'Princess Nourah University',
      code: 'PNU',
      status: 'ACTIVE' as const,
      ownerDisplayName: 'PNU Administrator',
      ownerEmail: 'admin@pnu.edu.sa',
      ownerPassword: 'short',
    }

    const result = createUniversityFormSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('validates updateUniversityFormSchema requiring at least one field', () => {
    expect(updateUniversityFormSchema.safeParse({}).success).toBe(false)
    expect(
      updateUniversityFormSchema.safeParse({ name: 'Updated Name' }).success,
    ).toBe(true)
  })

  it('validates updateUniversityStatusFormSchema', () => {
    expect(
      updateUniversityStatusFormSchema.safeParse({ status: 'SUSPENDED' })
        .success,
    ).toBe(true)
    expect(
      updateUniversityStatusFormSchema.safeParse({ status: 'INVALID' }).success,
    ).toBe(false)
  })

  it('validates universitySortFieldSchema including studentsCount', () => {
    expect(universitySortFieldSchema.safeParse('studentsCount').success).toBe(
      true,
    )
    expect(universitySortFieldSchema.safeParse('createdAt').success).toBe(true)
    expect(universitySortFieldSchema.safeParse('invalidField').success).toBe(
      false,
    )
  })
})
