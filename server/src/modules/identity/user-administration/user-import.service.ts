import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { isPrismaKnownRequestError } from '../../../platform/database/prisma-errors'
import { PasswordHasher } from '../password-hasher'
import type { AuthenticatedUser } from '../identity.types'
import type { AuditRequestContext } from '../../audit/audit.public'
import { createUserRequestSchema } from './user-administration.types'
import type { CreateUserImport } from './user-import.types'
import {
  UserImportRepository,
  type StagedUserImportRow,
  type UserImportRecord,
} from './user-import.repository'

@Injectable()
export class UserImportService {
  constructor(
    private readonly repository: UserImportRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(input: CreateUserImport, actor: AuthenticatedUser) {
    const parsedRows = input.rows.map((row) => {
      const result = createUserRequestSchema.safeParse({
        displayName: row.displayName,
        email: row.email,
        password: row.password,
        role: row.role,
      })
      return { source: row, result }
    })
    const candidateEmails = parsedRows.flatMap(({ result }) =>
      result.success ? [result.data.email] : [],
    )
    const existing = new Set(
      (await this.repository.findExistingEmails(candidateEmails)).map((user) =>
        user.email.toLowerCase(),
      ),
    )
    const counts = new Map<string, number>()
    candidateEmails.forEach((email) =>
      counts.set(email, (counts.get(email) ?? 0) + 1),
    )

    const rows: StagedUserImportRow[] = parsedRows.map(({ source, result }) => {
      if (!result.success) {
        return {
          rowNumber: source.rowNumber,
          displayName: cleanOptional(source.displayName, 120),
          email: cleanOptional(source.email, 320)?.toLowerCase() ?? null,
          role:
            source.role === 'STUDENT' || source.role === 'INSTRUCTOR'
              ? source.role
              : null,
          passwordHash: null,
          errors: result.error.issues.map((issue) => issue.message),
        }
      }

      const errors: string[] = []
      if ((counts.get(result.data.email) ?? 0) > 1) {
        errors.push('Email appears more than once in this import')
      }
      if (existing.has(result.data.email)) {
        errors.push('A user with this email already exists')
      }

      return {
        rowNumber: source.rowNumber,
        displayName: result.data.displayName,
        email: result.data.email,
        role: result.data.role,
        passwordHash:
          errors.length === 0
            ? this.passwordHasher.createHash(result.data.password)
            : null,
        errors,
      }
    })

    return {
      userImport: mapImport(await this.repository.createImport(actor.id, rows)),
    }
  }

  async get(importId: string) {
    const userImport = await this.repository.findImport(importId)
    if (userImport === null)
      throw new NotFoundException('User import not found')
    return { userImport: mapImport(userImport) }
  }

  async approve(
    importId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ) {
    try {
      const userImport = await this.repository.approveImport(
        importId,
        actor.id,
        requestContext,
      )
      if (userImport === null)
        throw new NotFoundException('User import not found')
      return { userImport: mapImport(userImport) }
    } catch (error) {
      if (isPrismaKnownRequestError(error) && error.code === 'P2002') {
        throw new ConflictException(
          'An imported email now belongs to an existing user',
        )
      }
      throw error
    }
  }
}

function cleanOptional(value: string, max: number) {
  const cleaned = value.trim().slice(0, max)
  return cleaned.length === 0 ? null : cleaned
}

function mapImport(userImport: UserImportRecord) {
  return {
    id: userImport.id,
    status: userImport.status,
    createdAt: userImport.createdAt.toISOString(),
    approvedAt: userImport.approvedAt?.toISOString() ?? null,
    rows: userImport.rows.map((row) => ({
      ...row,
      errors: Array.isArray(row.errors)
        ? row.errors.filter(
            (error): error is string => typeof error === 'string',
          )
        : [],
    })),
  }
}
