import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CONFIG_ENV_FILE_PATHS } from './modules/config/configuration';
import { validateEnv } from './modules/config/env.schema';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: CONFIG_ENV_FILE_PATHS,
      isGlobal: true,
      validate: validateEnv,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
