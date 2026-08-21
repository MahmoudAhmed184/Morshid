import { Injectable } from '@nestjs/common'

import { PasswordHasher } from '../identity/identity.public'
import {
  UniversityCodeAlreadyExistsError,
  UniversityNotFoundError,
  UniversityOwnerEmailAlreadyExistsError,
  universityCodeAlreadyExistsException,
  universityNotFoundException,
  universityOwnerEmailAlreadyExistsException,
} from './universities.errors'
import {
  UniversitiesRepository,
  type UpdateUniversityRepositoryInput,
  type UniversityRecord,
} from './universities.repository'
import {
  normalizeUniversityCode,
  normalizeEmail,
  type CreateUniversityRequest,
  type ListUniversitiesQuery,
  type UpdateUniversityRequest,
  type UpdateUniversityStatusRequest,
  type UniversityItemDto,
  type UniversityListResponseDto,
  type UniversityResponseDto,
} from './universities.types'

@Injectable()
export class UniversitiesService {
  constructor(
    private readonly universitiesRepository: UniversitiesRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async listUniversities(
    query: ListUniversitiesQuery,
  ): Promise<UniversityListResponseDto> {
    const page = await this.universitiesRepository.listUniversities(query)

    return {
      data: page.data.map(mapUniversityRecord),
      pagination: page.pagination,
    }
  }

  async getUniversity(universityId: string): Promise<UniversityResponseDto> {
    const university = await this.universitiesRepository.findById(universityId)

    if (university === null) {
      throw universityNotFoundException(universityId)
    }

    return {
      university: mapUniversityRecord(university),
    }
  }

  async createUniversity(
    input: CreateUniversityRequest,
  ): Promise<UniversityResponseDto> {
    const passwordHash = this.passwordHasher.createHash(input.owner.password)

    try {
      const university =
        await this.universitiesRepository.createUniversityWithAdminOwner({
          name: input.name.trim(),
          code: normalizeUniversityCode(input.code),
          status: input.status,
          owner: {
            displayName: input.owner.displayName.trim(),
            email: normalizeEmail(input.owner.email),
            passwordHash,
          },
        })

      return {
        university: mapUniversityRecord(university),
      }
    } catch (error) {
      if (error instanceof UniversityCodeAlreadyExistsError) {
        throw universityCodeAlreadyExistsException(error.code)
      }

      if (error instanceof UniversityOwnerEmailAlreadyExistsError) {
        throw universityOwnerEmailAlreadyExistsException(error.email)
      }

      throw error
    }
  }

  async updateUniversity(
    universityId: string,
    input: UpdateUniversityRequest,
  ): Promise<UniversityResponseDto> {
    try {
      let ownerInput: UpdateUniversityRepositoryInput['owner']

      if (input.owner) {
        ownerInput = {
          displayName: input.owner.displayName?.trim(),
          email:
            input.owner.email !== undefined
              ? normalizeEmail(input.owner.email)
              : undefined,
          passwordHash:
            input.owner.password !== undefined
              ? this.passwordHasher.createHash(input.owner.password)
              : undefined,
        }
      }

      const updated = await this.universitiesRepository.updateUniversity(
        universityId,
        {
          name: input.name?.trim(),
          code:
            input.code !== undefined
              ? normalizeUniversityCode(input.code)
              : undefined,
          owner: ownerInput,
        },
      )

      return {
        university: mapUniversityRecord(updated),
      }
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(error.universityId)
      }

      if (error instanceof UniversityCodeAlreadyExistsError) {
        throw universityCodeAlreadyExistsException(error.code)
      }

      if (error instanceof UniversityOwnerEmailAlreadyExistsError) {
        throw universityOwnerEmailAlreadyExistsException(error.email)
      }

      throw error
    }
  }

  async updateUniversityStatus(
    universityId: string,
    input: UpdateUniversityStatusRequest,
  ): Promise<UniversityResponseDto> {
    try {
      const updated = await this.universitiesRepository.updateUniversityStatus(
        universityId,
        input.status,
      )

      return {
        university: mapUniversityRecord(updated),
      }
    } catch (error) {
      if (error instanceof UniversityNotFoundError) {
        throw universityNotFoundException(error.universityId)
      }

      throw error
    }
  }
}

function mapUniversityRecord(record: UniversityRecord): UniversityItemDto {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    status: record.status,
    owner:
      record.owner === null
        ? null
        : {
            id: record.owner.id,
            displayName: record.owner.displayName,
            email: record.owner.email,
            status: record.owner.status,
          },
    studentsCount: record.studentsCount,
    instructorsCount: record.instructorsCount,
    coursesCount: record.coursesCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}
