import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { isPrismaKnownRequestError } from '../../../platform/database/prisma-errors'
import { PasswordHasher } from '../password-hasher'
import type { AuthenticatedUser } from '../identity.types'
import type { AuditRequestContext } from '../../audit/audit.public'
import {
  createUserRequestSchema,
  userPasswordSchema,
} from './user-administration.types'
import type { CreateUserImport, UpdateUserImportRow } from './user-import.types'
import {
  UserImportRepository,
  InvalidUserImportApprovalError,
  UserImportRowNotCancellableError,
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
          passwordHash: userPasswordSchema.safeParse(source.password).success
            ? this.passwordHasher.createHash(source.password)
            : null,
          errors: result.error.issues.map(
            (issue) => `${String(issue.path[0] ?? 'Row')}: ${issue.message}`,
          ),
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
        passwordHash: this.passwordHasher.createHash(result.data.password),
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

  async updateRow(importId: string, rowId: string, input: UpdateUserImportRow) {
    const userImport = await this.repository.findImport(importId)
    if (userImport === null)
      throw new NotFoundException('User import not found')
    if (userImport.status !== 'PENDING') {
      throw new ConflictException('Approved imports cannot be edited')
    }
    const editedRow = userImport.rows.find((row) => row.id === rowId)
    if (editedRow === undefined) {
      throw new NotFoundException('User import row not found')
    }
    if (editedRow.status === 'APPROVED' || editedRow.status === 'CANCELLED') {
      throw new ConflictException('This import row can no longer be edited')
    }

    const passwordHash =
      input.password === undefined
        ? editedRow.passwordHash
        : userPasswordSchema.safeParse(input.password).success
          ? this.passwordHasher.createHash(input.password)
          : null
    const candidates = userImport.rows
      .filter((row) => row.status !== 'CANCELLED')
      .map((row) => ({
        ...row,
        displayName:
          row.id === rowId && input.displayName !== undefined
            ? cleanOptional(input.displayName, 120)
            : row.displayName,
        email:
          row.id === rowId && input.email !== undefined
            ? (cleanOptional(input.email, 320)?.toLowerCase() ?? null)
            : row.email,
        role:
          row.role === 'STUDENT' || row.role === 'INSTRUCTOR' ? row.role : null,
        passwordHash: row.id === rowId ? passwordHash : row.passwordHash,
        errors: Array.isArray(row.errors)
          ? row.errors.filter(
              (error): error is string => typeof error === 'string',
            )
          : [],
      }))
    const emails = candidates.flatMap((row) =>
      row.email === null ? [] : [row.email],
    )
    const existing = new Set(
      (await this.repository.findExistingEmails(emails)).map((user) =>
        user.email.toLowerCase(),
      ),
    )
    const counts = countEmails(emails)
    const rows = candidates.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      passwordHash: row.passwordHash,
      errors: validateStoredRow(row, counts, existing),
    }))

    return {
      userImport: mapImport(await this.repository.updateRows(importId, rows)),
    }
  }

  async cancelRow(importId: string, rowId: string) {
    const userImport = await this.repository.findImport(importId)
    if (userImport === null)
      throw new NotFoundException('User import not found')
    if (userImport.status !== 'PENDING') {
      throw new ConflictException('Approved imports cannot be changed')
    }
    const row = userImport.rows.find((candidate) => candidate.id === rowId)
    if (row === undefined)
      throw new NotFoundException('User import row not found')
    if (row.status === 'APPROVED' || row.status === 'CANCELLED') {
      throw new ConflictException('This import row cannot be removed')
    }
    try {
      const cancelledImport = await this.repository.cancelRow(importId, rowId)
      const candidates = cancelledImport.rows
        .filter((candidate) => candidate.status !== 'CANCELLED')
        .map((candidate) => ({
          ...candidate,
          role:
            candidate.role === 'STUDENT' || candidate.role === 'INSTRUCTOR'
              ? candidate.role
              : null,
          errors: Array.isArray(candidate.errors)
            ? candidate.errors.filter(
                (error): error is string => typeof error === 'string',
              )
            : [],
        }))
      if (candidates.length === 0) {
        return { userImport: mapImport(cancelledImport) }
      }
      const emails = candidates.flatMap((candidate) =>
        candidate.email === null ? [] : [candidate.email],
      )
      const existing = new Set(
        (await this.repository.findExistingEmails(emails)).map((user) =>
          user.email.toLowerCase(),
        ),
      )
      const counts = countEmails(emails)
      const rows = candidates.map((candidate) => ({
        id: candidate.id,
        rowNumber: candidate.rowNumber,
        displayName: candidate.displayName,
        email: candidate.email,
        role: candidate.role,
        passwordHash: candidate.passwordHash,
        errors: validateStoredRow(candidate, counts, existing),
      }))
      return {
        userImport: mapImport(await this.repository.updateRows(importId, rows)),
      }
    } catch (error) {
      if (error instanceof UserImportRowNotCancellableError) {
        throw new ConflictException('This import row cannot be removed')
      }
      throw error
    }
  }

  async approve(
    importId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ) {
    if (actor.universityId === null) {
      throw new ForbiddenException('Actor must belong to a university')
    }

    try {
      const userImport = await this.repository.approveImport(
        importId,
        actor.id,
        actor.universityId,
        requestContext,
      )
      if (userImport === null)
        throw new NotFoundException('User import not found')
      return { userImport: mapImport(userImport) }
    } catch (error) {
      if (error instanceof InvalidUserImportApprovalError) {
        throw new BadRequestException(error.message)
      }
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
    rows: userImport.rows.map(({ passwordHash, ...row }) => ({
      ...row,
      hasPassword: passwordHash !== null,
      errors: Array.isArray(row.errors)
        ? row.errors.filter(
            (error): error is string => typeof error === 'string',
          )
        : [],
    })),
  }
}

function countEmails(emails: string[]) {
  const counts = new Map<string, number>()
  emails.forEach((email) => counts.set(email, (counts.get(email) ?? 0) + 1))
  return counts
}

function validateStoredRow(
  row: {
    displayName: string | null
    email: string | null
    role: 'STUDENT' | 'INSTRUCTOR' | null
    passwordHash: string | null
    errors: string[]
  },
  counts: Map<string, number>,
  existing: Set<string>,
) {
  const errors: string[] = []
  const nameResult = createUserRequestSchema.shape.displayName.safeParse(
    row.displayName ?? '',
  )
  if (!nameResult.success) {
    errors.push(
      `Name: ${nameResult.error.issues[0]?.message ?? 'Invalid name'}`,
    )
  }
  const emailResult = createUserRequestSchema.shape.email.safeParse(
    row.email ?? '',
  )
  if (!emailResult.success) {
    errors.push(
      `Email: ${emailResult.error.issues[0]?.message ?? 'Invalid email'}`,
    )
  } else {
    if ((counts.get(emailResult.data) ?? 0) > 1) {
      errors.push('Email: Email appears more than once in this import')
    }
    if (existing.has(emailResult.data)) {
      errors.push('Email: A user with this email already exists')
    }
  }
  if (row.role === null) errors.push('Role: Invalid role')
  if (row.passwordHash === null) {
    const detailedPasswordErrors = row.errors.filter(
      (error) =>
        error.toLowerCase().startsWith('password:') &&
        !error.includes('Enter a password that meets the password policy'),
    )
    if (detailedPasswordErrors.length > 0) {
      errors.push(...detailedPasswordErrors)
    } else {
      const missingPassword = userPasswordSchema.safeParse('')
      if (!missingPassword.success) {
        errors.push(
          ...missingPassword.error.issues.map(
            (issue) => `Password: ${issue.message}`,
          ),
        )
      }
    }
  }
  return errors
}
