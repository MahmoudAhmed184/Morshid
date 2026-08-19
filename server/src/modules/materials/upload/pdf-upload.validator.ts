import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../../platform/config/env.schema'
import {
  invalidMaterialsRequestException,
  pdfTooLargeException,
  type MaterialsValidationIssue,
} from '../catalog/materials.errors'
import {
  MATERIAL_TITLE_MAX_LENGTH,
  PDF_UPLOAD_FILE_EXTENSION,
  PDF_UPLOAD_MIME_TYPE,
} from './materials.constants'
import {
  DEFAULT_PDF_MAX_UPLOAD_BYTES,
  readMaterialsConfiguration,
} from './materials.configuration'

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
    expectedCourseId?: string
    courseId?: unknown
    title: unknown
    file?: UploadedPdfFile
  }): ValidatedPdfUpload {
    const issues: MaterialsValidationIssue[] = []
    const title =
      typeof input.title === 'string' ? input.title.trim() : undefined

    if (input.courseId !== undefined) {
      const courseId =
        typeof input.courseId === 'string' ? input.courseId.trim() : ''
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          courseId,
        )
      if (!isUuid) {
        issues.push({
          field: 'courseId',
          message: 'Course ID must be a valid UUID',
        })
      } else if (
        input.expectedCourseId !== undefined &&
        courseId !== input.expectedCourseId
      ) {
        issues.push({
          field: 'courseId',
          message: 'Course ID in request body must match route parameter',
        })
      }
    }

    if (title === undefined || title.length === 0) {
      issues.push({
        field: 'title',
        message: 'Title is required',
      })
    } else if (Array.from(title).length > MATERIAL_TITLE_MAX_LENGTH) {
      issues.push({
        field: 'title',
        message: `Title must be at most ${String(MATERIAL_TITLE_MAX_LENGTH)} characters`,
      })
    }

    if (input.file === undefined) {
      issues.push({
        field: 'file',
        message: 'PDF file is required',
      })
      throw invalidMaterialsRequestException(issues)
    }

    const maxBytes = readMaterialsConfiguration(
      this.configService,
    ).PDF_MAX_UPLOAD_BYTES
    const file = input.file
    const originalFilename = sanitizeOriginalFilename(file.originalname)

    if (file.size > maxBytes) {
      throw pdfTooLargeException()
    }

    if (!originalFilename.toLowerCase().endsWith(PDF_UPLOAD_FILE_EXTENSION)) {
      issues.push({
        field: 'file',
        message: 'File extension must be .pdf',
      })
    }

    if (file.mimetype !== PDF_UPLOAD_MIME_TYPE) {
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
