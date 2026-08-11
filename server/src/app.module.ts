import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuditModule } from './modules/audit/audit.module'
import { IdentityModule } from './modules/identity/identity.module'
import { CONFIG_ENV_FILE_PATHS } from './platform/config/configuration'
import { validateEnv } from './platform/config/env.schema'
import { CoursesModule } from './modules/courses/courses.module'
import { HealthModule } from './modules/health/health.module'
import { ConversationsHttpModule } from './modules/conversations/conversations-http.module'
import { PdfStorageModule } from './platform/document-storage/pdf-storage.module'
import { EmbeddingModule } from './platform/ai/embedding/embedding.module'
import { MaterialsModule } from './modules/materials/materials.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { TutoringModule } from './modules/tutoring/tutoring.module'

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
    IdentityModule,
    CoursesModule,
    ConversationsHttpModule,
    PdfStorageModule,
    EmbeddingModule,
    MaterialsModule,
    TutoringModule,
    ReviewsModule,
  ],
})
export class AppModule {}
