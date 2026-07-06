import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuditModule } from './modules/audit/audit.module'
import { CONFIG_ENV_FILE_PATHS } from './modules/config/configuration'
import { validateEnv } from './modules/config/env.schema'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: CONFIG_ENV_FILE_PATHS,
      isGlobal: true,
      validate: validateEnv,
    }),
    AuditModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule { }
