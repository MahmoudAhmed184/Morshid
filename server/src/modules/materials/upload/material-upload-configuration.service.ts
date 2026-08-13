import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../../platform/config/env.schema'
import {
  PDF_UPLOAD_FILE_EXTENSION,
  PDF_UPLOAD_MIME_TYPE,
} from './materials.constants'
import { readMaterialsConfiguration } from './materials.configuration'
import type { MaterialUploadConfigurationDto } from '../catalog/materials.dto'

@Injectable()
export class MaterialUploadConfigurationService {
  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  getConfiguration(): MaterialUploadConfigurationDto {
    return {
      maxUploadBytes: readMaterialsConfiguration(this.configService)
        .PDF_MAX_UPLOAD_BYTES,
      acceptedMimeType: PDF_UPLOAD_MIME_TYPE,
      acceptedFileExtension: PDF_UPLOAD_FILE_EXTENSION,
    }
  }
}
