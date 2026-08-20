import { Injectable } from '@nestjs/common'

import {
  Prisma,
  UniversityStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'
import { PrismaService } from '../../platform/database/prisma.service'
import type { UniversitySortField, SortOrder } from './universities.types'
import {
  UniversityCodeAlreadyExistsError,
  UniversityNotFoundError,
  UniversityOwnerEmailAlreadyExistsError,
} from './universities.errors'

export interface UniversityOwnerRecord {
  id: string
  displayName: string
  email: string
  status: UserStatus
}

export interface UniversityRecord {
  id: string
  name: string
  code: string
  status: UniversityStatus
  ownerId: string | null
  owner: UniversityOwnerRecord | null
  studentsCount: number
  instructorsCount: number
  coursesCount: number
  createdAt: Date
  updatedAt: Date
}

export interface ListUniversitiesRepositoryInput {
  page: number
  limit: number
  search?: string
  status?: UniversityStatus
  sortBy: UniversitySortField
  sortOrder: SortOrder
}

export interface UniversitiesPageRecord {
  data: UniversityRecord[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export interface CreateUniversityRepositoryInput {
  name: string
  code: string
  status: UniversityStatus
  owner: {
    displayName: string
    email: string
    passwordHash: string
  }
}

export interface UpdateUniversityRepositoryInput {
  name?: string
  code?: string
  owner?: {
    displayName?: string
    email?: string
    passwordHash?: string
  }
}

const universityOwnerSelect = {
  id: true,
  displayName: true,
  email: true,
  status: true,
} satisfies Prisma.UserSelect

const universityRecordSelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: universityOwnerSelect,
  },
  _count: {
    select: {
      courses: true,
    },
  },
} satisfies Prisma.UniversitySelect

type RawUniversityRecord = Prisma.UniversityGetPayload<{
  select: typeof universityRecordSelect
}>

export abstract class UniversitiesRepository {
  abstract listUniversities(
    input: ListUniversitiesRepositoryInput,
  ): Promise<UniversitiesPageRecord>

  abstract findById(universityId: string): Promise<UniversityRecord | null>

  abstract findByCode(code: string): Promise<UniversityRecord | null>

  abstract createUniversityWithAdminOwner(
    input: CreateUniversityRepositoryInput,
  ): Promise<UniversityRecord>

  abstract updateUniversity(
    universityId: string,
    input: UpdateUniversityRepositoryInput,
  ): Promise<UniversityRecord>

  abstract updateUniversityStatus(
    universityId: string,
    status: UniversityStatus,
  ): Promise<UniversityRecord>
}

@Injectable()
export class PrismaUniversitiesRepository extends UniversitiesRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  async listUniversities(
    input: ListUniversitiesRepositoryInput,
  ): Promise<UniversitiesPageRecord> {
    const where: Prisma.UniversityWhereInput = {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.search !== undefined && input.search.length > 0
        ? {
            OR: [
              {
                name: {
                  contains: input.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                code: {
                  contains: input.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                owner: {
                  displayName: {
                    contains: input.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                owner: {
                  email: {
                    contains: input.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
    }

    const skip = (input.page - 1) * input.limit
    const take = input.limit

    if (input.sortBy === 'studentsCount') {
      const orderDir =
        input.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
      const searchSql =
        input.search !== undefined && input.search.length > 0
          ? Prisma.sql`AND (
              u.name ILIKE ${`%${input.search}%`} OR
              u.code ILIKE ${`%${input.search}%`} OR
              owner.display_name ILIKE ${`%${input.search}%`} OR
              owner.email ILIKE ${`%${input.search}%`}
            )`
          : Prisma.empty
      const statusSql =
        input.status !== undefined
          ? Prisma.sql`AND u.status = ${input.status}::"UniversityStatus"`
          : Prisma.empty

      const [countResult, rows] = await Promise.all([
        this.prismaService.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(DISTINCT u.id) as count
          FROM universities u
          LEFT JOIN users owner ON u.owner_id = owner.id
          WHERE 1=1 ${statusSql} ${searchSql}
        `,
        this.prismaService.$queryRaw<{ id: string }[]>`
          SELECT u.id, COUNT(usr.id) FILTER (WHERE usr.role = 'STUDENT') as student_count
          FROM universities u
          LEFT JOIN users usr ON usr.university_id = u.id AND usr.role = 'STUDENT'
          LEFT JOIN users owner ON u.owner_id = owner.id
          WHERE 1=1 ${statusSql} ${searchSql}
          GROUP BY u.id
          ORDER BY student_count ${orderDir}, u.id DESC
          LIMIT ${take} OFFSET ${skip}
        `,
      ])

      const totalCount =
        countResult.length > 0 ? Number(countResult[0].count) : 0
      const universityIds = rows.map((r) => r.id)
      if (universityIds.length === 0) {
        return {
          data: [],
          pagination: {
            page: input.page,
            limit: input.limit,
            totalCount,
            totalPages:
              totalCount === 0 ? 0 : Math.ceil(totalCount / input.limit),
          },
        }
      }

      const universities = await this.prismaService.university.findMany({
        where: { id: { in: universityIds } },
        select: universityRecordSelect,
      })

      const userCounts = await this.prismaService.user.groupBy({
        by: ['universityId', 'role'],
        where: {
          universityId: { in: universityIds },
          role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
        },
        _count: { _all: true },
      })

      const countMap = new Map<
        string,
        { studentsCount: number; instructorsCount: number }
      >()

      for (const item of userCounts) {
        if (item.universityId === null) {
          continue
        }

        const current = countMap.get(item.universityId) ?? {
          studentsCount: 0,
          instructorsCount: 0,
        }

        if (item.role === UserRole.STUDENT) {
          current.studentsCount = item._count._all
        } else if (item.role === UserRole.INSTRUCTOR) {
          current.instructorsCount = item._count._all
        }

        countMap.set(item.universityId, current)
      }

      const uniMap = new Map(universities.map((u) => [u.id, u]))
      const data = universityIds
        .map((id) => uniMap.get(id))
        .filter(
          (uni): uni is (typeof universities)[number] => uni !== undefined,
        )
        .map((uni) => {
          const counts = countMap.get(uni.id) ?? {
            studentsCount: 0,
            instructorsCount: 0,
          }

          return {
            id: uni.id,
            name: uni.name,
            code: uni.code,
            status: uni.status,
            ownerId: uni.ownerId,
            owner: uni.owner,
            studentsCount: counts.studentsCount,
            instructorsCount: counts.instructorsCount,
            coursesCount: uni._count.courses,
            createdAt: uni.createdAt,
            updatedAt: uni.updatedAt,
          }
        })

      const totalPages =
        totalCount === 0 ? 0 : Math.ceil(totalCount / input.limit)

      return {
        data,
        pagination: {
          page: input.page,
          limit: input.limit,
          totalCount,
          totalPages,
        },
      }
    }

    const [totalCount, universities] = await Promise.all([
      this.prismaService.university.count({ where }),
      this.prismaService.university.findMany({
        where,
        orderBy: [{ [input.sortBy]: input.sortOrder }, { id: 'desc' }],
        skip,
        take,
        select: universityRecordSelect,
      }),
    ])

    const universityIds = universities.map((u) => u.id)
    const userCounts =
      universityIds.length === 0
        ? []
        : await this.prismaService.user.groupBy({
            by: ['universityId', 'role'],
            where: {
              universityId: { in: universityIds },
              role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
            },
            _count: { _all: true },
          })

    const countMap = new Map<
      string,
      { studentsCount: number; instructorsCount: number }
    >()

    for (const item of userCounts) {
      if (item.universityId === null) {
        continue
      }

      const current = countMap.get(item.universityId) ?? {
        studentsCount: 0,
        instructorsCount: 0,
      }

      if (item.role === UserRole.STUDENT) {
        current.studentsCount = item._count._all
      } else if (item.role === UserRole.INSTRUCTOR) {
        current.instructorsCount = item._count._all
      }

      countMap.set(item.universityId, current)
    }

    const data = universities.map((uni) => {
      const counts = countMap.get(uni.id) ?? {
        studentsCount: 0,
        instructorsCount: 0,
      }

      return {
        id: uni.id,
        name: uni.name,
        code: uni.code,
        status: uni.status,
        ownerId: uni.ownerId,
        owner: uni.owner,
        studentsCount: counts.studentsCount,
        instructorsCount: counts.instructorsCount,
        coursesCount: uni._count.courses,
        createdAt: uni.createdAt,
        updatedAt: uni.updatedAt,
      }
    })

    const totalPages =
      totalCount === 0 ? 0 : Math.ceil(totalCount / input.limit)

    return {
      data,
      pagination: {
        page: input.page,
        limit: input.limit,
        totalCount,
        totalPages,
      },
    }
  }

  async findById(universityId: string): Promise<UniversityRecord | null> {
    const university = await this.prismaService.university.findUnique({
      where: { id: universityId },
      select: universityRecordSelect,
    })

    if (university === null) {
      return null
    }

    const userCounts = await this.prismaService.user.groupBy({
      by: ['role'],
      where: {
        universityId,
        role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
      },
      _count: { _all: true },
    })

    return formatUniversityRecord(university, userCounts)
  }

  async findByCode(code: string): Promise<UniversityRecord | null> {
    const university = await this.prismaService.university.findFirst({
      where: {
        code: { equals: code, mode: Prisma.QueryMode.insensitive },
      },
      select: universityRecordSelect,
    })

    if (university === null) {
      return null
    }

    const userCounts = await this.prismaService.user.groupBy({
      by: ['role'],
      where: {
        universityId: university.id,
        role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
      },
      _count: { _all: true },
    })

    return formatUniversityRecord(university, userCounts)
  }

  async createUniversityWithAdminOwner(
    input: CreateUniversityRepositoryInput,
  ): Promise<UniversityRecord> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const existingUniversity = await tx.university.findFirst({
            where: {
              code: { equals: input.code, mode: Prisma.QueryMode.insensitive },
            },
            select: { id: true },
          })

          if (existingUniversity !== null) {
            throw new UniversityCodeAlreadyExistsError(input.code)
          }

          const existingUser = await tx.user.findUnique({
            where: { email: input.owner.email },
            select: { id: true },
          })

          if (existingUser !== null) {
            throw new UniversityOwnerEmailAlreadyExistsError(input.owner.email)
          }

          const university = await tx.university.create({
            data: {
              name: input.name,
              code: input.code,
              status: input.status,
              ownerId: null,
            },
            select: { id: true },
          })

          await tx.universitySubscription.create({
            data: {
              universityId: university.id,
            },
          })

          const adminUser = await tx.user.create({
            data: {
              email: input.owner.email,
              displayName: input.owner.displayName,
              role: UserRole.ADMIN,
              status: UserStatus.ACTIVE,
              passwordHash: input.owner.passwordHash,
              universityId: university.id,
            },
            select: universityOwnerSelect,
          })

          const updatedUniversity = await tx.university.update({
            where: { id: university.id },
            data: { ownerId: adminUser.id },
            select: universityRecordSelect,
          })

          return {
            id: updatedUniversity.id,
            name: updatedUniversity.name,
            code: updatedUniversity.code,
            status: updatedUniversity.status,
            ownerId: updatedUniversity.ownerId,
            owner: adminUser,
            studentsCount: 0,
            instructorsCount: 0,
            coursesCount: 0,
            createdAt: updatedUniversity.createdAt,
            updatedAt: updatedUniversity.updatedAt,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const target = (error as { meta?: { target?: string[] } }).meta?.target
        if (Array.isArray(target) && target.includes('code')) {
          throw new UniversityCodeAlreadyExistsError(input.code)
        }
        if (Array.isArray(target) && target.includes('email')) {
          throw new UniversityOwnerEmailAlreadyExistsError(input.owner.email)
        }
      }
      throw error
    }
  }

  async updateUniversity(
    universityId: string,
    input: UpdateUniversityRepositoryInput,
  ): Promise<UniversityRecord> {
    try {
      return await this.prismaService.$transaction(
        async (tx) => {
          const current = await tx.university.findUnique({
            where: { id: universityId },
            select: { id: true, code: true, ownerId: true },
          })

          if (current === null) {
            throw new UniversityNotFoundError(universityId)
          }

          if (input.code !== undefined && input.code !== current.code) {
            const duplicate = await tx.university.findFirst({
              where: {
                code: {
                  equals: input.code,
                  mode: Prisma.QueryMode.insensitive,
                },
                NOT: { id: universityId },
              },
              select: { id: true },
            })

            if (duplicate !== null) {
              throw new UniversityCodeAlreadyExistsError(input.code)
            }
          }

          const updated = await tx.university.update({
            where: { id: universityId },
            data: {
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.code !== undefined ? { code: input.code } : {}),
            },
            select: universityRecordSelect,
          })

          if (input.owner !== undefined && current.ownerId !== null) {
            if (input.owner.email !== undefined) {
              const existingUser = await tx.user.findFirst({
                where: {
                  email: input.owner.email,
                  NOT: { id: current.ownerId },
                },
                select: { id: true },
              })

              if (existingUser !== null) {
                throw new UniversityOwnerEmailAlreadyExistsError(
                  input.owner.email,
                )
              }
            }

            const ownerData: Record<string, string> = {}
            if (input.owner.displayName !== undefined) {
              ownerData.displayName = input.owner.displayName
            }
            if (input.owner.email !== undefined) {
              ownerData.email = input.owner.email
            }
            if (input.owner.passwordHash !== undefined) {
              ownerData.passwordHash = input.owner.passwordHash
            }

            if (Object.keys(ownerData).length > 0) {
              await tx.user.update({
                where: { id: current.ownerId },
                data: ownerData,
              })
            }
          }

          const userCounts = await tx.user.groupBy({
            by: ['role'],
            where: {
              universityId,
              role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
            },
            _count: { _all: true },
          })

          return formatUniversityRecord(updated, userCounts)
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      if (error instanceof UniversityOwnerEmailAlreadyExistsError) {
        throw error
      }

      if (isUniqueConstraintViolation(error)) {
        if (input.code !== undefined) {
          throw new UniversityCodeAlreadyExistsError(input.code)
        }
        if (input.owner?.email !== undefined) {
          throw new UniversityOwnerEmailAlreadyExistsError(input.owner.email)
        }
      }
      throw error
    }
  }

  async updateUniversityStatus(
    universityId: string,
    status: UniversityStatus,
  ): Promise<UniversityRecord> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.university.findUnique({
        where: { id: universityId },
        select: { id: true },
      })

      if (current === null) {
        throw new UniversityNotFoundError(universityId)
      }

      const updated = await tx.university.update({
        where: { id: universityId },
        data: { status },
        select: universityRecordSelect,
      })

      const userCounts = await tx.user.groupBy({
        by: ['role'],
        where: {
          universityId,
          role: { in: [UserRole.STUDENT, UserRole.INSTRUCTOR] },
        },
        _count: { _all: true },
      })

      return formatUniversityRecord(updated, userCounts)
    })
  }
}

function formatUniversityRecord(
  university: RawUniversityRecord,
  userCounts: { role: UserRole; _count: { _all: number } }[],
): UniversityRecord {
  let studentsCount = 0
  let instructorsCount = 0

  for (const item of userCounts) {
    if (item.role === UserRole.STUDENT) {
      studentsCount = item._count._all
    } else if (item.role === UserRole.INSTRUCTOR) {
      instructorsCount = item._count._all
    }
  }

  return {
    id: university.id,
    name: university.name,
    code: university.code,
    status: university.status,
    ownerId: university.ownerId,
    owner: university.owner,
    studentsCount,
    instructorsCount,
    coursesCount: university._count.courses,
    createdAt: university.createdAt,
    updatedAt: university.updatedAt,
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}
