import { Injectable } from '@nestjs/common'

import {
  Prisma,
  UserImportRowStatus,
  UserImportStatus,
  UserStatus,
} from '../../../generated/prisma/client'
import { PrismaService } from '../../../platform/database/prisma.service'
import { asDatabaseTransaction } from '../../../platform/database/database-transaction'
import type { AuditRequestContext } from '../../audit/audit.public'
import { UserAdministrationAuditService } from './user-administration-audit'

export interface StagedUserImportRow {
  rowNumber: number
  displayName: string | null
  email: string | null
  role: 'STUDENT' | 'INSTRUCTOR' | null
  passwordHash: string | null
  errors: string[]
}

export interface UpdatedUserImportRow extends StagedUserImportRow {
  id: string
}

export class InvalidUserImportApprovalError extends Error {}
export class UserImportRowNotCancellableError extends Error {}

const importSelect = {
  id: true,
  status: true,
  createdAt: true,
  approvedAt: true,
  rows: {
    orderBy: { rowNumber: 'asc' as const },
    select: {
      id: true,
      rowNumber: true,
      displayName: true,
      email: true,
      role: true,
      status: true,
      errors: true,
      passwordHash: true,
    },
  },
} satisfies Prisma.UserImportSelect

export type UserImportRecord = Prisma.UserImportGetPayload<{
  select: typeof importSelect
}>

@Injectable()
export class UserImportRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: UserAdministrationAuditService,
  ) {}

  findExistingEmails(emails: string[]) {
    return this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })
  }

  createImport(createdById: string, rows: StagedUserImportRow[]) {
    return this.prisma.userImport.create({
      data: {
        createdById,
        rows: {
          create: rows.map((row) => ({
            ...row,
            errors: row.errors,
            status:
              row.errors.length === 0
                ? UserImportRowStatus.VALID
                : UserImportRowStatus.INVALID,
          })),
        },
      },
      select: importSelect,
    })
  }

  findImport(importId: string) {
    return this.prisma.userImport.findUnique({
      where: { id: importId },
      select: importSelect,
    })
  }

  async updateRows(importId: string, rows: UpdatedUserImportRow[]) {
    await this.prisma.$transaction(
      rows.map(({ id, rowNumber: _rowNumber, ...data }) =>
        this.prisma.userImportRow.update({
          where: { id, importId },
          data: {
            ...data,
            status:
              data.errors.length === 0
                ? UserImportRowStatus.VALID
                : UserImportRowStatus.INVALID,
          },
        }),
      ),
    )
    return this.prisma.userImport.findUniqueOrThrow({
      where: { id: importId },
      select: importSelect,
    })
  }

  async cancelRow(importId: string, rowId: string) {
    const result = await this.prisma.userImportRow.updateMany({
      where: {
        id: rowId,
        importId,
        status: {
          in: [UserImportRowStatus.VALID, UserImportRowStatus.INVALID],
        },
        import: { status: UserImportStatus.PENDING },
      },
      data: { status: UserImportRowStatus.CANCELLED },
    })
    if (result.count !== 1) {
      throw new UserImportRowNotCancellableError()
    }
    return this.prisma.userImport.findUniqueOrThrow({
      where: { id: importId },
      select: importSelect,
    })
  }

  approveImport(
    importId: string,
    actorUserId: string,
    universityId: string,
    requestContext?: AuditRequestContext,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const userImport = await tx.userImport.findUnique({
          where: { id: importId },
          select: {
            status: true,
            rows: {
              select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                passwordHash: true,
                status: true,
              },
            },
          },
        })

        if (userImport === null) return null
        if (userImport.status === UserImportStatus.APPROVED) {
          return tx.userImport.findUniqueOrThrow({
            where: { id: importId },
            select: importSelect,
          })
        }

        const activeRows = userImport.rows.filter(
          (row) => row.status !== UserImportRowStatus.CANCELLED,
        )
        if (
          activeRows.length === 0 ||
          activeRows.some((row) => row.status !== UserImportRowStatus.VALID)
        ) {
          throw new InvalidUserImportApprovalError(
            'Every import row must be valid before approval',
          )
        }

        const emails = activeRows.map((row) => row.email).filter(isString)
        if (
          new Set(emails.map((email) => email.toLowerCase())).size !==
          emails.length
        ) {
          throw new InvalidUserImportApprovalError(
            'Import contains duplicate emails',
          )
        }
        const existingUsers = await tx.user.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
        if (existingUsers.length > 0) {
          throw new InvalidUserImportApprovalError(
            'An imported email belongs to an existing user',
          )
        }

        for (const row of activeRows) {
          if (
            row.email === null ||
            row.email === '' ||
            row.displayName === null ||
            row.displayName === '' ||
            row.role === null ||
            row.passwordHash === null ||
            row.passwordHash === ''
          ) {
            throw new Error('Valid import row is missing secured user data')
          }

          const user = await tx.user.create({
            data: {
              email: row.email,
              displayName: row.displayName,
              role: row.role,
              status: UserStatus.ACTIVE,
              passwordHash: row.passwordHash,
              universityId,
            },
          })
          await tx.userImportRow.update({
            where: { id: row.id },
            data: {
              status: UserImportRowStatus.APPROVED,
              createdUserId: user.id,
            },
          })
          await this.audit.recordUserCreated(
            { actorUserId, targetUser: user, requestContext },
            asDatabaseTransaction(tx),
          )
        }

        await tx.userImport.update({
          where: { id: importId },
          data: { status: UserImportStatus.APPROVED, approvedAt: new Date() },
        })

        return tx.userImport.findUniqueOrThrow({
          where: { id: importId },
          select: importSelect,
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  }
}

function isString(value: string | null): value is string {
  return value !== null && value !== ''
}
