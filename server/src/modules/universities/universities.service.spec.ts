import {
  UniversityCodeAlreadyExistsError,
  UniversityNotFoundError,
  UniversityOwnerEmailAlreadyExistsError,
} from './universities.errors'
import {
  UniversitiesRepository,
  type CreateUniversityRepositoryInput,
  type ListUniversitiesRepositoryInput,
  type UniversitiesPageRecord,
  type UniversityRecord,
  type UpdateUniversityRepositoryInput,
} from './universities.repository'
import { UniversitiesService } from './universities.service'
import { UniversityStatus, UserStatus } from '../identity/identity.roles'
import type { PasswordHasher } from '../identity/identity.public'

class TestUniversitiesRepository extends UniversitiesRepository {
  readonly listUniversities = jest.fn(
    (
      _input: ListUniversitiesRepositoryInput,
    ): Promise<UniversitiesPageRecord> =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 },
      }),
  )

  readonly findById = jest.fn(
    (_universityId: string): Promise<UniversityRecord | null> =>
      Promise.resolve(null),
  )

  readonly findByCode = jest.fn(
    (_code: string): Promise<UniversityRecord | null> => Promise.resolve(null),
  )

  readonly createUniversityWithAdminOwner = jest.fn(
    (_input: CreateUniversityRepositoryInput): Promise<UniversityRecord> =>
      Promise.reject(new Error('Not implemented')),
  )

  readonly updateUniversity = jest.fn(
    (
      _universityId: string,
      _input: UpdateUniversityRepositoryInput,
    ): Promise<UniversityRecord> =>
      Promise.reject(new Error('Not implemented')),
  )

  readonly updateUniversityStatus = jest.fn(
    (
      _universityId: string,
      _status: UniversityStatus,
    ): Promise<UniversityRecord> =>
      Promise.reject(new Error('Not implemented')),
  )
}

describe('UniversitiesService', () => {
  let service: UniversitiesService
  let repository: TestUniversitiesRepository
  let createHash: jest.Mock<string, [string]>

  const now = new Date('2026-08-19T12:00:00.000Z')

  const dummyRecord: UniversityRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cairo University',
    code: 'CU',
    status: UniversityStatus.ACTIVE,
    ownerId: '00000000-0000-4000-8000-000000000002',
    owner: {
      id: '00000000-0000-4000-8000-000000000002',
      displayName: 'Cairo Admin',
      email: 'admin@cu.edu.eg',
      status: UserStatus.ACTIVE,
    },
    studentsCount: 15,
    instructorsCount: 4,
    coursesCount: 3,
    createdAt: now,
    updatedAt: now,
  }

  beforeEach(() => {
    repository = new TestUniversitiesRepository()
    createHash = jest.fn((pw: string) => `hashed:${pw}`)
    const passwordHasher = { createHash } as unknown as PasswordHasher
    service = new UniversitiesService(repository, passwordHasher)
  })

  describe('listUniversities', () => {
    it('returns formatted list with pagination', async () => {
      repository.listUniversities.mockResolvedValue({
        data: [dummyRecord],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
        },
      })

      const result = await service.listUniversities({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      expect(repository.listUniversities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        id: dummyRecord.id,
        name: dummyRecord.name,
        code: dummyRecord.code,
        status: dummyRecord.status,
        studentsCount: dummyRecord.studentsCount,
        instructorsCount: dummyRecord.instructorsCount,
        coursesCount: dummyRecord.coursesCount,
        createdAt: dummyRecord.createdAt.toISOString(),
        updatedAt: dummyRecord.updatedAt.toISOString(),
      })
    })

    it('passes sortBy=studentsCount to repository', async () => {
      repository.listUniversities.mockResolvedValue({
        data: [dummyRecord],
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 1,
          totalPages: 1,
        },
      })

      await service.listUniversities({
        page: 1,
        limit: 20,
        sortBy: 'studentsCount',
        sortOrder: 'desc',
      })

      expect(repository.listUniversities).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'studentsCount',
        sortOrder: 'desc',
      })
    })
  })

  describe('getUniversity', () => {
    it('returns a single university when found', async () => {
      repository.findById.mockResolvedValue(dummyRecord)

      const result = await service.getUniversity(dummyRecord.id)

      expect(repository.findById).toHaveBeenCalledWith(dummyRecord.id)
      expect(result.university.id).toBe(dummyRecord.id)
      expect(result.university.name).toBe(dummyRecord.name)
    })

    it('throws NotFoundException when university does not exist', async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.getUniversity('missing-id')).rejects.toThrow(
        'University was not found',
      )
    })
  })

  describe('createUniversity', () => {
    const input = {
      name: 'King Saud University',
      code: 'KSU',
      status: UniversityStatus.ACTIVE,
      owner: {
        displayName: 'Dr. Fatima',
        email: 'fatima@ksu.edu.sa',
        password: 'SecurePassword123!',
      },
    }

    it('creates a university with hashed password and normalized code/email', async () => {
      repository.createUniversityWithAdminOwner.mockResolvedValue({
        ...dummyRecord,
        name: input.name,
        code: 'KSU',
        owner: {
          id: 'new-owner-id',
          displayName: input.owner.displayName,
          email: input.owner.email,
          status: UserStatus.ACTIVE,
        },
      })

      const result = await service.createUniversity(input)

      expect(createHash).toHaveBeenCalledWith(input.owner.password)
      expect(repository.createUniversityWithAdminOwner).toHaveBeenCalledWith({
        name: input.name,
        code: 'KSU',
        status: UniversityStatus.ACTIVE,
        owner: {
          displayName: input.owner.displayName,
          email: input.owner.email,
          passwordHash: 'hashed:SecurePassword123!',
        },
      })
      expect(result.university.name).toBe(input.name)
    })

    it('throws ConflictException when code already exists', async () => {
      repository.createUniversityWithAdminOwner.mockRejectedValue(
        new UniversityCodeAlreadyExistsError('KSU'),
      )

      await expect(service.createUniversity(input)).rejects.toThrow(
        'A university with this code already exists',
      )
    })

    it('throws ConflictException when owner email already exists', async () => {
      repository.createUniversityWithAdminOwner.mockRejectedValue(
        new UniversityOwnerEmailAlreadyExistsError(input.owner.email),
      )

      await expect(service.createUniversity(input)).rejects.toThrow(
        'A user with this email already exists',
      )
    })
  })

  describe('updateUniversity', () => {
    it('updates university metadata', async () => {
      repository.updateUniversity.mockResolvedValue({
        ...dummyRecord,
        name: 'Cairo University (Main)',
        code: 'CU-MAIN',
      })

      const result = await service.updateUniversity(dummyRecord.id, {
        name: 'Cairo University (Main)',
        code: 'cu-main',
      })

      expect(repository.updateUniversity).toHaveBeenCalledWith(dummyRecord.id, {
        name: 'Cairo University (Main)',
        code: 'CU-MAIN',
      })
      expect(result.university.name).toBe('Cairo University (Main)')
      expect(result.university.code).toBe('CU-MAIN')
    })

    it('throws NotFoundException when university does not exist', async () => {
      repository.updateUniversity.mockRejectedValue(
        new UniversityNotFoundError('missing-id'),
      )

      await expect(
        service.updateUniversity('missing-id', { name: 'New Name' }),
      ).rejects.toThrow('University was not found')
    })

    it('throws ConflictException when code already taken', async () => {
      repository.updateUniversity.mockRejectedValue(
        new UniversityCodeAlreadyExistsError('TAKEN'),
      )

      await expect(
        service.updateUniversity(dummyRecord.id, { code: 'TAKEN' }),
      ).rejects.toThrow('A university with this code already exists')
    })
  })

  describe('updateUniversityStatus', () => {
    it('updates status to SUSPENDED', async () => {
      repository.updateUniversityStatus.mockResolvedValue({
        ...dummyRecord,
        status: UniversityStatus.SUSPENDED,
      })

      const result = await service.updateUniversityStatus(dummyRecord.id, {
        status: UniversityStatus.SUSPENDED,
      })

      expect(repository.updateUniversityStatus).toHaveBeenCalledWith(
        dummyRecord.id,
        UniversityStatus.SUSPENDED,
      )
      expect(result.university.status).toBe(UniversityStatus.SUSPENDED)
    })

    it('throws NotFoundException when university does not exist', async () => {
      repository.updateUniversityStatus.mockRejectedValue(
        new UniversityNotFoundError('missing-id'),
      )

      await expect(
        service.updateUniversityStatus('missing-id', {
          status: UniversityStatus.SUSPENDED,
        }),
      ).rejects.toThrow('University was not found')
    })
  })
})
