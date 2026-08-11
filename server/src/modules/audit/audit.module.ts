import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { AccessAuditService } from './access-audit.service'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AccessAuditService],
  exports: [AuditService, AccessAuditService],
})
export class AuditModule {}
