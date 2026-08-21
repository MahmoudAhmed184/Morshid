import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { RedisModule } from '../../platform/cache/redis.module'
import { AiCapacityService } from './ai-capacity.service'
import { AdminAiCapacityController } from './admin-ai-capacity.controller'

@Module({
  imports: [ConfigModule, RedisModule],
  controllers: [AdminAiCapacityController],
  providers: [AiCapacityService],
  exports: [AiCapacityService],
})
export class AiCapacityModule {}
