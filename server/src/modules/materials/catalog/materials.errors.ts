import {
  BadRequestException,
  PayloadTooLargeException,
  type HttpException,
} from '@nestjs/common'

export const MATERIALS_ERROR_CODES = {
  INVALID_REQUEST: 'MATERIALS_INVALID_REQUEST',
  PDF_TOO_LARGE: 'MATERIALS_PDF_TOO_LARGE',
  COURSE_MANAGEMENT_REQUIRED: 'MATERIALS_COURSE_MANAGEMENT_REQUIRED',
  COURSE_NOT_FOUND: 'MATERIALS_COURSE_NOT_FOUND',
  MATERIAL_NOT_FOUND: 'MATERIALS_MATERIAL_NOT_FOUND',
  MATERIAL_RETRY_NOT_ALLOWED: 'MATERIALS_MATERIAL_RETRY_NOT_ALLOWED',
  MATERIAL_RETRY_SCHEDULING_FAILED:
    'MATERIALS_MATERIAL_RETRY_SCHEDULING_FAILED',
  MATERIAL_DELETE_FORBIDDEN: 'MATERIALS_MATERIAL_DELETE_FORBIDDEN',
  STORAGE_CLEANUP_FAILED: 'MATERIALS_STORAGE_CLEANUP_FAILED',
} as const

export interface MaterialsValidationIssue {
  field: string
  message: string
}

export function invalidMaterialsRequestException(
  errors: MaterialsValidationIssue[] = [],
): HttpException {
  return new BadRequestException({
    code: MATERIALS_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid materials request',
    errors,
  })
}

export function pdfTooLargeException(): HttpException {
  return new PayloadTooLargeException({
    code: MATERIALS_ERROR_CODES.PDF_TOO_LARGE,
    message: 'PDF upload exceeds the configured size limit',
  })
}
