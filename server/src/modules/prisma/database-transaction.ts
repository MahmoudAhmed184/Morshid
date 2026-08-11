import type { Prisma } from '../../generated/prisma/client'
import { Injectable } from '@nestjs/common'

import { PrismaService } from './prisma.service'

export interface DatabaseTransaction {
  readonly __databaseTransaction: unique symbol
}

export function asDatabaseTransaction(
  transaction: Prisma.TransactionClient,
): DatabaseTransaction {
  return transaction as unknown as DatabaseTransaction
}

export function asPrismaTransaction(
  transaction: DatabaseTransaction,
): Prisma.TransactionClient {
  return transaction as unknown as Prisma.TransactionClient
}

export abstract class DatabaseTransactionRunner {
  abstract run<T>(
    work: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T>
}

@Injectable()
export class PrismaDatabaseTransactionRunner extends DatabaseTransactionRunner {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  run<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.prismaService.$transaction((transaction) =>
      work(asDatabaseTransaction(transaction)),
    )
  }
}
