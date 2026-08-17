import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from './platform/config/env.schema'
import { configureApp } from './app.setup'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()
  const configService = app.get(ConfigService<AppEnvironment, true>)
  const port = configService.get('PORT', { infer: true })
  const clientOrigin = configService.get('CLIENT_ORIGIN', { infer: true })
  const allowedOrigins = Array.from(
    new Set([clientOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000']),
  )

  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
  })

  configureApp(app)

  await app.listen(port)
}
void bootstrap()
