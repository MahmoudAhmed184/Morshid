import type { Prisma } from '../../generated/prisma/client'

export async function currentDatabaseTime(
  database: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<Date> {
  const rows = await database.$queryRaw<{ now: Date }[]>`SELECT now() AS now`

  return rows[0].now
}
