import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'

import { PrismaService } from '../prisma/prisma.service'
import {
  DurableMaterialProcessingScheduler,
  MaterialProcessingScheduler,
} from './material-processing.scheduler'
import { MaterialProcessingService } from './material-processing.service'
import { MaterialTextChunker } from './material-text-chunker'
import {
  MaterialsRepository,
  PrismaMaterialsRepository,
} from './materials.repository'
import { PDF_TEXT_EXTRACTOR, PdfJsTextExtractor } from './pdf-text-extractor'
import { MaterialsModule } from './materials.module'

describe('MaterialsModule processing graph', () => {
  it('resolves the one registered production implementation for every seam', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
              REDIS_URL: 'redis://localhost:6379',
              PDF_STORAGE_PATH: '../storage/test-pdfs',
              PDF_MAX_UPLOAD_BYTES: 1_048_576,
              EMBEDDING_PROVIDER: 'deterministic',
              AUTH_ACCESS_TOKEN_SECRET:
                'module-test-access-token-secret-000001',
              AUTH_REFRESH_TOKEN_HASH_SECRET:
                'module-test-refresh-token-secret-0001',
              AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
              AUTH_REFRESH_TOKEN_TTL_DAYS: 7,
            }),
          ],
        }),
        MaterialsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile()

    expect(moduleRef.get(MaterialProcessingService)).toBeInstanceOf(
      MaterialProcessingService,
    )
    expect(moduleRef.get(MaterialTextChunker)).toBeInstanceOf(
      MaterialTextChunker,
    )
    expect(moduleRef.get(MaterialsRepository)).toBeInstanceOf(
      PrismaMaterialsRepository,
    )
    expect(moduleRef.get(PDF_TEXT_EXTRACTOR)).toBeInstanceOf(PdfJsTextExtractor)
    expect(moduleRef.get(MaterialProcessingScheduler)).toBeInstanceOf(
      DurableMaterialProcessingScheduler,
    )
  })
})
