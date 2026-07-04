import { Injectable } from '@nestjs/common';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async checkDatabase(): Promise<HealthIndicatorResult<'database'>> {
    try {
      await this.prismaService.ping();

      return {
        database: {
          status: 'up',
        },
      };
    } catch {
      throw new HealthCheckError('Database readiness check failed', {
        database: {
          status: 'down',
        },
      });
    }
  }

  async checkRedis(): Promise<HealthIndicatorResult<'redis'>> {
    try {
      const response = await this.redisService.ping();

      if (response !== 'PONG') {
        throw new Error('Redis ping did not return PONG');
      }

      return {
        redis: {
          status: 'up',
        },
      };
    } catch {
      throw new HealthCheckError('Redis readiness check failed', {
        redis: {
          status: 'down',
        },
      });
    }
  }

  async checkPgVector(): Promise<HealthIndicatorResult<'pgvector'>> {
    try {
      const exists = await this.prismaService.hasPgVectorExtension();

      if (!exists) {
        throw new Error('pgvector extension is not installed');
      }

      return {
        pgvector: {
          status: 'up',
        },
      };
    } catch {
      throw new HealthCheckError('pgvector readiness check failed', {
        pgvector: {
          status: 'down',
        },
      });
    }
  }
}
