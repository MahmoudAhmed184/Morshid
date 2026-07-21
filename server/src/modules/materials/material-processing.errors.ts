export const MATERIAL_PROCESSING_ERROR_CODES = {
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  PDF_READ_FAILED: 'PDF_READ_FAILED',
  NO_EXTRACTABLE_TEXT: 'NO_EXTRACTABLE_TEXT',
  CHUNKING_FAILED: 'CHUNKING_FAILED',
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  PERSISTENCE_FAILED: 'PERSISTENCE_FAILED',
  NOT_PROCESSABLE: 'NOT_PROCESSABLE',
} as const

export type MaterialProcessingErrorCode =
  (typeof MATERIAL_PROCESSING_ERROR_CODES)[keyof typeof MATERIAL_PROCESSING_ERROR_CODES]

export const MATERIAL_PROCESSING_SAFE_MESSAGES = {
  STORAGE_READ_FAILED: 'The PDF could not be read.',
  PDF_READ_FAILED: 'The PDF could not be read.',
  NO_EXTRACTABLE_TEXT:
    'No extractable text was found. Scanned PDFs are not supported.',
  CHUNKING_FAILED: 'The extracted content could not be prepared for retrieval.',
  EMBEDDING_FAILED: 'The material could not be embedded.',
  PERSISTENCE_FAILED:
    'The extracted content could not be prepared for retrieval.',
  NOT_PROCESSABLE: 'The material is not available for processing.',
} satisfies Record<MaterialProcessingErrorCode, string>

export class SafeMaterialProcessingError extends Error {
  constructor(
    readonly code: MaterialProcessingErrorCode,
    message: string = MATERIAL_PROCESSING_SAFE_MESSAGES[code],
  ) {
    super(message)
    this.name = 'SafeMaterialProcessingError'
  }
}

export class MaterialNoLongerProcessableError extends Error {
  constructor(readonly materialId: string) {
    super('Material is no longer processable')
    this.name = 'MaterialNoLongerProcessableError'
  }
}
