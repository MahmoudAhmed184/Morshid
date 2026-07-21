import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { CONFIG_ENV_FILE_PATHS } from './modules/config/configuration'
import { validateEnv } from './modules/config/env.schema'
import { CoursesModule } from './modules/courses/courses.module'
import { HealthModule } from './modules/health/health.module'
import { AdminModule } from './modules/admin/admin.module'
import { StudentChatModule } from './modules/student-chat/student-chat.module'
import { RagPersistenceModule } from './modules/rag-persistence/rag-persistence.module'
import { PdfStorageModule } from './modules/pdf-storage/pdf-storage.module'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { MaterialsModule } from './modules/materials/materials.module'
import { RetrievalModule } from './modules/retrieval/retrieval.module'
import { CompletionModule } from './modules/completion/completion.module'

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
    CoursesModule,
    AdminModule,
    StudentChatModule,
    RagPersistenceModule,
    PdfStorageModule,
    EmbeddingModule,
    CompletionModule,
    RetrievalModule,
    MaterialsModule,
  ],
})
export class AppModule {}
