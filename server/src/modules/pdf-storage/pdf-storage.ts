export interface PdfStorage {
  create(contents: Buffer): Promise<string>
  read(storagePath: string): Promise<Buffer>
  delete(storagePath: string): Promise<void>
}

export const PDF_STORAGE = Symbol('PdfStorage')

export class InvalidPdfStoragePathError extends Error {
  constructor(storagePath: string) {
    super(`Invalid PDF storage path: ${storagePath}`)
    this.name = 'InvalidPdfStoragePathError'
  }
}

export class PdfStorageNotFoundError extends Error {
  constructor(readonly storagePath: string) {
    super(`PDF storage object not found: ${storagePath}`)
    this.name = 'PdfStorageNotFoundError'
  }
}
