import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../platform/config/env.schema'
import { MaterialUploadConfigurationService } from './material-upload-configuration.service'

describe('MaterialUploadConfigurationService', () => {
  it('exposes the effective server limit and enforced PDF type contract', () => {
    const get = jest.fn((key: string) => {
      switch (key) {
        case 'PDF_MAX_UPLOAD_BYTES':
          return 2_097_152
        case 'RETRIEVAL_TOP_K':
          return 5
        case 'RETRIEVAL_MIN_SIMILARITY':
          return 0.62
        default:
          return undefined
      }
    })
    const configService = {
      get,
    } as unknown as ConfigService<AppEnvironment, true>
    const service = new MaterialUploadConfigurationService(configService)

    expect(service.getConfiguration()).toEqual({
      maxUploadBytes: 2_097_152,
      acceptedMimeType: 'application/pdf',
      acceptedFileExtension: '.pdf',
    })
    expect(get).toHaveBeenCalledWith('PDF_MAX_UPLOAD_BYTES', {
      infer: true,
    })
  })
})
