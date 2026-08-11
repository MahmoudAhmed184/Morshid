import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuditModule } from './modules/audit/audit.module'
import { IdentityModule } from './modules/identity/identity.module'
import { CompletionModule } from './modules/completion/completion.module'
import { CONFIG_ENV_FILE_PATHS } from './modules/config/configuration'
import { validateEnv } from './modules/config/env.schema'
import { CoursesModule } from './modules/courses/courses.module'
import { HealthModule } from './modules/health/health.module'
import { StudentChatModule } from './modules/student-chat/student-chat.module'
import { PdfStorageModule } from './modules/pdf-storage/pdf-storage.module'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { MaterialsModule } from './modules/materials/materials.module'
import { RetrievalModule } from './modules/retrieval/retrieval.module'
import { SocraticTutorModule } from './modules/socratic-tutor/socratic-tutor.module'
import { ReviewsModule } from './modules/reviews/reviews.module'

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
    StudentChatModule,
    PdfStorageModule,
    EmbeddingModule,
    RetrievalModule,
    MaterialsModule,
    CompletionModule,
    SocraticTutorModule,
    ReviewsModule,
  ],
})
export class AppModule {}
