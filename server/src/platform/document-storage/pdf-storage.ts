// The storage seam is fully buffered: implementations hold the whole object in
// memory for both create and read. To bound heap use until a streaming upload
// workflow exists, every implementation MUST enforce `MAX_PDF_OBJECT_BYTES` on
// both writes (reject oversized input) and reads (reject oversized objects).
export const MAX_PDF_OBJECT_BYTES = 100 * 1024 * 1024

export interface PdfStorage {
  create(contents: Buffer): Promise<string>
  read(storagePath: string): Promise<Buffer>
  exists(storagePath: string): Promise<boolean>
  delete(storagePath: string): Promise<void>
}

export const PDF_STORAGE = Symbol('PdfStorage')

export class InvalidPdfStoragePathError extends Error {
  constructor(storagePath: string) {
    super(`Invalid PDF storage path: ${describeStoragePath(storagePath)}`)
    this.name = 'InvalidPdfStoragePathError'
  }
}

export class PdfStorageNotFoundError extends Error {
  constructor(readonly storagePath: string) {
    super(`PDF storage object not found: ${describeStoragePath(storagePath)}`)
    this.name = 'PdfStorageNotFoundError'
  }
}

export class PdfStorageObjectTooLargeError extends Error {
  constructor(
    readonly byteLength: number,
    readonly maxByteLength: number = MAX_PDF_OBJECT_BYTES,
  ) {
    super(
      `PDF storage object of ${String(byteLength)} bytes exceeds the ${String(maxByteLength)} byte limit`,
    )
    this.name = 'PdfStorageObjectTooLargeError'
  }
}

// Prevents control characters, NUL bytes, and unbounded attacker-controlled keys
// from being echoed verbatim into error messages and logs.
function describeStoragePath(storagePath: string): string {
  const sanitized = Array.from(storagePath.slice(0, 80))
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      const isPrintable = codePoint >= 0x20 && codePoint !== 0x7f

      return isPrintable ? character : '?'
    })
    .join('')

  return sanitized.length === 0 ? '<empty>' : sanitized
}
