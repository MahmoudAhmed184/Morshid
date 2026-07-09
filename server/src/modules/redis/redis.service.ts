import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from 'redis'

import type { AppEnvironment } from '../config/env.schema'

type RedisClient = ReturnType<typeof createClient>

const DISABLED_USER_KEY_PREFIX = 'user:'
const DISABLED_USER_KEY_SUFFIX = ':disabled'

function disabledUserKey(userId: string) {
  return `${DISABLED_USER_KEY_PREFIX}${userId}${DISABLED_USER_KEY_SUFFIX}`
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private readonly client: RedisClient

  constructor(configService: ConfigService<AppEnvironment, true>) {
    this.client = createClient({
      url: configService.get('REDIS_URL', { infer: true }),
    })

    this.client.on('error', (error) => {
      this.logger.error(error)
    })
  }

  async onModuleInit() {
    if (!this.client.isOpen) {
      await this.client.connect()
    }
  }

  async onModuleDestroy() {
    if (this.client.isOpen) {
      await this.client.quit()
    }
  }

  async ping() {
    return this.client.ping()
  }

  getClient() {
    return this.client
  }

  async setUserDisabled(userId: string): Promise<void> {
    await this.client.set(disabledUserKey(userId), 'true')
  }

  async removeUserDisabled(userId: string): Promise<void> {
    await this.client.del(disabledUserKey(userId))
  }

  async isUserDisabled(userId: string): Promise<boolean> {
    const result = await this.client.get(disabledUserKey(userId))
    return result === 'true'
  }
}
