import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { MaterialUploadConfigurationService } from './material-upload-configuration.service'

describe('MaterialUploadConfigurationService', () => {
  it('exposes the effective server limit and enforced PDF type contract', () => {
    const configService = {
      get: jest.fn().mockReturnValue(2_097_152),
    } as unknown as ConfigService<AppEnvironment, true>
    const service = new MaterialUploadConfigurationService(configService)

    expect(service.getConfiguration()).toEqual({
      maxUploadBytes: 2_097_152,
      acceptedMimeType: 'application/pdf',
      acceptedFileExtension: '.pdf',
    })
    expect(configService.get).toHaveBeenCalledWith('PDF_MAX_UPLOAD_BYTES', {
      infer: true,
    })
  })
})
