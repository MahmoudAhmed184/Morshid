import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { PrismaModule } from '../../platform/database/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { AdminAllowancesController } from './admin-allowances.controller'
import { AllowancesPolicyRepository } from './allowances-policy.repository'
import { AllowancesService } from './allowances.service'
import { AllowancesResolver } from './interface/allowances-resolver'

@Module({
  imports: [PrismaModule, AuditModule, ConfigModule],
  controllers: [AdminAllowancesController],
  providers: [
    AllowancesPolicyRepository,
    AllowancesService,
    {
      provide: AllowancesResolver,
      useExisting: AllowancesService,
    },
  ],
  exports: [AllowancesResolver, AllowancesService],
})
export class AllowancesModule {}
