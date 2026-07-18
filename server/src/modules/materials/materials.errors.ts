import {
  BadRequestException,
  PayloadTooLargeException,
  type HttpException,
} from '@nestjs/common'

export const MATERIALS_ERROR_CODES = {
  INVALID_REQUEST: 'MATERIALS_INVALID_REQUEST',
  PDF_TOO_LARGE: 'MATERIALS_PDF_TOO_LARGE',
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

export function pdfTooLargeException(maxBytes: number): HttpException {
  return new PayloadTooLargeException({
    code: MATERIALS_ERROR_CODES.PDF_TOO_LARGE,
    message: 'PDF upload exceeds the configured size limit',
    maxBytes,
  })
}
