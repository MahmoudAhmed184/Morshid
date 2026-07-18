import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  DEFAULT_PDF_MAX_UPLOAD_BYTES,
  type AppEnvironment,
} from '../config/env.schema'
import {
  invalidMaterialsRequestException,
  pdfTooLargeException,
  type MaterialsValidationIssue,
} from './materials.errors'

const PDF_SIGNATURE = Buffer.from('%PDF-')
const MAX_DISPLAY_FILENAME_LENGTH = 255

export interface UploadedPdfFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export interface ValidatedPdfUpload {
  title: string
  originalFilename: string
  buffer: Buffer
  mimetype: string
  size: number
}

@Injectable()
export class PdfUploadValidator {
  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  validate(input: {
    title: unknown
    file?: UploadedPdfFile
  }): ValidatedPdfUpload {
    const issues: MaterialsValidationIssue[] = []
    const title =
      typeof input.title === 'string' ? input.title.trim() : undefined

    if (title === undefined || title.length === 0) {
      issues.push({
        field: 'title',
        message: 'Title is required',
      })
    }

    if (input.file === undefined) {
      issues.push({
        field: 'file',
        message: 'PDF file is required',
      })
      throw invalidMaterialsRequestException(issues)
    }

    const maxBytes = this.configService.get('PDF_MAX_UPLOAD_BYTES', {
      infer: true,
    })
    const file = input.file
    const originalFilename = sanitizeOriginalFilename(file.originalname)

    if (file.size > maxBytes) {
      throw pdfTooLargeException(maxBytes)
    }

    if (!originalFilename.toLowerCase().endsWith('.pdf')) {
      issues.push({
        field: 'file',
        message: 'File extension must be .pdf',
      })
    }

    if (file.mimetype !== 'application/pdf') {
      issues.push({
        field: 'file',
        message: 'File MIME type must be application/pdf',
      })
    }

    if (!file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      issues.push({
        field: 'file',
        message: 'File contents must start with a PDF signature',
      })
    }

    if (issues.length > 0 || title === undefined) {
      throw invalidMaterialsRequestException(issues)
    }

    return {
      title,
      originalFilename,
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    }
  }
}

function sanitizeOriginalFilename(originalName: string): string {
  const lastSegment = originalName.split(/[\\/]/).at(-1)?.trim() ?? ''
  const printable = Array.from(lastSegment)
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0

      return codePoint >= 0x20 && codePoint !== 0x7f ? character : '?'
    })
    .join('')

  const filename = printable.length === 0 ? 'upload.pdf' : printable

  return filename.slice(0, MAX_DISPLAY_FILENAME_LENGTH)
}

export function getDefaultPdfMaxUploadBytes(): number {
  return DEFAULT_PDF_MAX_UPLOAD_BYTES
}
