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

  approveImport(
    importId: string,
    actorUserId: string,
    requestContext?: AuditRequestContext,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const userImport = await tx.userImport.findUnique({
          where: { id: importId },
          select: {
            status: true,
            rows: {
              where: { status: UserImportRowStatus.VALID },
              select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                passwordHash: true,
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

        for (const row of userImport.rows) {
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
