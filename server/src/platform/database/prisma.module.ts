import { Module } from '@nestjs/common'

import { PrismaService } from './prisma.service'
import {
  DatabaseTransactionRunner,
  PrismaDatabaseTransactionRunner,
} from './database-transaction'

@Module({
  providers: [
    PrismaService,
    {
      provide: DatabaseTransactionRunner,
      useClass: PrismaDatabaseTransactionRunner,
    },
  ],
  exports: [PrismaService, DatabaseTransactionRunner],
})
export class PrismaModule {}
