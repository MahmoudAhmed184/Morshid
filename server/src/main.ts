import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import type { AppEnvironment } from './modules/config/env.schema';
import { configureApp } from './app.setup';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppEnvironment, true>);
  const port = configService.get('PORT', { infer: true });
  const clientOrigin = configService.get('CLIENT_ORIGIN', { infer: true });

  app.enableCors({
    origin: clientOrigin,
  });
  configureApp(app);

  await app.listen(port);
}
void bootstrap();
