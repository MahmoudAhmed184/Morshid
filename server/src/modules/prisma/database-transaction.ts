import type { Prisma } from '../../generated/prisma/client'

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
