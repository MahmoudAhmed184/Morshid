import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { PrismaModule } from '../../platform/database/prisma.module'
import { RedisModule } from '../../platform/cache/redis.module'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
  imports: [TerminusModule, PrismaModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
