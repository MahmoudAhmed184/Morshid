import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import {
  PDF_UPLOAD_FILE_EXTENSION,
  PDF_UPLOAD_MIME_TYPE,
} from './materials.constants'
import type { MaterialUploadConfigurationDto } from './materials.dto'

@Injectable()
export class MaterialUploadConfigurationService {
  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  getConfiguration(): MaterialUploadConfigurationDto {
    return {
      maxUploadBytes: this.configService.get('PDF_MAX_UPLOAD_BYTES', {
        infer: true,
      }),
      acceptedMimeType: PDF_UPLOAD_MIME_TYPE,
      acceptedFileExtension: PDF_UPLOAD_FILE_EXTENSION,
    }
  }
}
