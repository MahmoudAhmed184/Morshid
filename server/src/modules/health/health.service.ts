import { Injectable } from '@nestjs/common'
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus'

import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'

class ReadinessHealthCheckError extends Error {
  // Terminus checks this structural flag instead of requiring HealthCheckError.
  readonly isHealthCheckError = true

  constructor(
    message: string,
    readonly causes: HealthIndicatorResult,
  ) {
    super(message)
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async checkDatabase(): Promise<HealthIndicatorResult<'database'>> {
    return this.checkIndicator(
      'database',
      () => this.prismaService.ping(),
      'Database readiness check failed',
    )
  }

  async checkRedis(): Promise<HealthIndicatorResult<'redis'>> {
    return this.checkIndicator(
      'redis',
      async () => {
        const response = await this.redisService.ping()

        if (response !== 'PONG') {
          throw new Error('Redis ping did not return PONG')
        }
      },
      'Redis readiness check failed',
    )
  }

  async checkPgVector(): Promise<HealthIndicatorResult<'pgvector'>> {
    return this.checkIndicator(
      'pgvector',
      async () => {
        const exists = await this.prismaService.hasPgVectorExtension()

        if (!exists) {
          throw new Error('pgvector extension is not installed')
        }
      },
      'pgvector readiness check failed',
    )
  }

  private async checkIndicator<const Key extends string>(
    key: Key,
    probe: () => Promise<void>,
    failureMessage: string,
  ): Promise<HealthIndicatorResult<Key>> {
    try {
      await probe()

      return this.healthIndicatorService.check(key).up()
    } catch {
      throw new ReadinessHealthCheckError(
        failureMessage,
        this.healthIndicatorService.check(key).down(),
      )
    }
  }
}
