import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../config/env.schema'
import { MATERIAL_TITLE_MAX_LENGTH } from './materials.constants'
import {
  PdfUploadValidator,
  type UploadedPdfFile,
} from './pdf-upload.validator'

const maxBytes = 10 * 1024 * 1024
const validPdf = Buffer.from('%PDF-1.7\nminimal test pdf')

function buildValidator() {
  const configService = {
    get: jest.fn(() => maxBytes),
  } as unknown as ConfigService<AppEnvironment, true>

  return new PdfUploadValidator(configService)
}

function buildFile(overrides: Partial<UploadedPdfFile> = {}): UploadedPdfFile {
  const buffer = overrides.buffer ?? validPdf

  return {
    originalname: 'python.pdf',
    mimetype: 'application/pdf',
    size: buffer.byteLength,
    buffer,
    ...overrides,
  }
}

describe('PdfUploadValidator', () => {
  it('accepts a valid PDF upload and trims the title', () => {
    const validator = buildValidator()

    expect(
      validator.validate({
        title: '  Python basics  ',
        file: buildFile(),
      }),
    ).toMatchObject({
      title: 'Python basics',
      originalFilename: 'python.pdf',
      mimetype: 'application/pdf',
      size: validPdf.byteLength,
    })
  })

  it('rejects a missing file', () => {
    const validator = buildValidator()

    expect(() => validator.validate({ title: 'Python basics' })).toThrow(
      BadRequestException,
    )
  })

  it('rejects an empty title', () => {
    const validator = buildValidator()

    expect(() =>
      validator.validate({ title: '   ', file: buildFile() }),
    ).toThrow(BadRequestException)
  })

  it('accepts a title at the storage boundary', () => {
    const validator = buildValidator()
    const title = 'a'.repeat(MATERIAL_TITLE_MAX_LENGTH)

    expect(validator.validate({ title, file: buildFile() }).title).toBe(title)
  })

  it('rejects a title beyond the storage boundary before persistence', () => {
    const validator = buildValidator()

    expect(() =>
      validator.validate({
        title: 'a'.repeat(MATERIAL_TITLE_MAX_LENGTH + 1),
        file: buildFile(),
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects a non-PDF extension', () => {
    const validator = buildValidator()

    expect(() =>
      validator.validate({
        title: 'Python basics',
        file: buildFile({ originalname: 'python.txt' }),
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects the wrong MIME type', () => {
    const validator = buildValidator()

    expect(() =>
      validator.validate({
        title: 'Python basics',
        file: buildFile({ mimetype: 'text/plain' }),
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects a missing PDF signature', () => {
    const validator = buildValidator()
    const buffer = Buffer.from('not a pdf')

    expect(() =>
      validator.validate({
        title: 'Python basics',
        file: buildFile({ buffer, size: buffer.byteLength }),
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects oversize PDFs with 413', () => {
    const validator = buildValidator()

    expect(() =>
      validator.validate({
        title: 'Python basics',
        file: buildFile({ size: maxBytes + 1 }),
      }),
    ).toThrow(PayloadTooLargeException)
  })

  it('keeps dangerous original filenames out of local paths', () => {
    const validator = buildValidator()

    expect(
      validator.validate({
        title: 'Python basics',
        file: buildFile({ originalname: '../nested\\python.pdf' }),
      }),
    ).toMatchObject({
      originalFilename: 'python.pdf',
    })
  })
})
