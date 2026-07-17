import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { LocalPdfStorageAdapter } from './local-pdf-storage.adapter'
import { PDF_STORAGE } from './pdf-storage'

@Module({
  providers: [
    {
      provide: PDF_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) =>
        new LocalPdfStorageAdapter(
          configService.get('PDF_STORAGE_PATH', { infer: true }),
        ),
    },
  ],
  exports: [PDF_STORAGE],
})
export class PdfStorageModule {}
