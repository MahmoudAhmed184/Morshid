import { describe, expect, it } from 'vitest'

import {
  instructorMaterialResponseSchema,
  instructorMaterialSchema,
  instructorMaterialsResponseSchema,
  instructorMaterialUploadConfigurationSchema,
  createInstructorMaterialUploadSchema,
} from './instructor-material.schema'

const validMaterial = {
  id: '3e533215-42ba-42b8-ad6a-404e7bb3c8d7',
  courseId: 'f5bb713c-09b7-42d3-acf3-02f39a902e5a',
  title: 'Python Functions',
  originalFilename: 'python-functions.pdf',
  status: 'READY',
  extractedTextLength: 4_820,
  chunkCount: 6,
  errorMessage: null,
  createdAt: '2026-07-21T12:00:00.000Z',
  updatedAt: '2026-07-21T12:01:00.000Z',
} as const

function createPdfFile(
  name = 'python-functions.pdf',
  type = 'application/pdf',
) {
  return new File(['%PDF-1.7'], name, { type })
}

function parseUpload(input: Record<string, unknown> = {}) {
  return createInstructorMaterialUploadSchema(1_024).safeParse({
    title: 'Python Functions',
    file: createPdfFile(),
    ...input,
  })
}

describe('Instructor material contract schemas', () => {
  it('parses a valid material response value', () => {
    expect(instructorMaterialSchema.parse(validMaterial)).toEqual(validMaterial)
  })

  it('rejects an invalid material status', () => {
    expect(() =>
      instructorMaterialSchema.parse({
        ...validMaterial,
        status: 'ARCHIVED',
      }),
    ).toThrow()
  })

  it('accepts nullable material processing fields', () => {
    const processingMaterial = {
      ...validMaterial,
      status: 'PROCESSING',
      extractedTextLength: null,
      chunkCount: null,
      errorMessage: null,
    }

    expect(instructorMaterialSchema.parse(processingMaterial)).toEqual(
      processingMaterial,
    )
  })

  it('validates the material list response wrapper', () => {
    const response = { materials: [validMaterial] }

    expect(instructorMaterialsResponseSchema.parse(response)).toEqual(response)
    expect(() =>
      instructorMaterialsResponseSchema.parse({ material: validMaterial }),
    ).toThrow()
    expect(() =>
      instructorMaterialsResponseSchema.parse({ materials: [null] }),
    ).toThrow()
  })

  it('validates the single-material response wrapper', () => {
    const response = { material: validMaterial }

    expect(instructorMaterialResponseSchema.parse(response)).toEqual(response)
    expect(() =>
      instructorMaterialResponseSchema.parse({ materials: [validMaterial] }),
    ).toThrow()
    expect(() =>
      instructorMaterialResponseSchema.parse({ material: null }),
    ).toThrow()
  })
})

describe('Instructor material upload schema', () => {
  it('parses effective upload constraints from the server', () => {
    expect(
      instructorMaterialUploadConfigurationSchema.parse({
        maxUploadBytes: 1_024,
        acceptedMimeType: 'application/pdf',
        acceptedFileExtension: '.pdf',
      }),
    ).toEqual({
      maxUploadBytes: 1_024,
      acceptedMimeType: 'application/pdf',
      acceptedFileExtension: '.pdf',
    })
  })

  it('accepts and trims a valid PDF upload', () => {
    const result = parseUpload({ title: '  Python Functions  ' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Python Functions')
      expect(result.data.file).toBeInstanceOf(File)
    }
  })

  it('requires a non-empty title', () => {
    expect(parseUpload({ title: undefined }).success).toBe(false)
    expect(parseUpload({ title: '   ' }).success).toBe(false)
  })

  it('accepts a 180-character title and rejects a longer title', () => {
    expect(parseUpload({ title: 'a'.repeat(180) }).success).toBe(true)
    expect(parseUpload({ title: 'a'.repeat(181) }).success).toBe(false)
  })

  it('requires a file', () => {
    expect(parseUpload({ file: undefined }).success).toBe(false)
  })

  it('requires the PDF MIME type', () => {
    expect(
      parseUpload({
        file: createPdfFile('python-functions.pdf', 'text/plain'),
      }).success,
    ).toBe(false)
  })

  it('requires a .pdf filename and accepts a case-insensitive extension', () => {
    expect(
      parseUpload({ file: createPdfFile('python-functions.txt') }).success,
    ).toBe(false)
    expect(
      parseUpload({ file: createPdfFile('python-functions.PDF') }).success,
    ).toBe(true)
  })

  it('accepts the effective maximum and rejects a larger PDF', () => {
    expect(
      parseUpload({
        file: new File([new Uint8Array(1_024)], 'maximum.pdf', {
          type: 'application/pdf',
        }),
      }).success,
    ).toBe(true)
    expect(
      parseUpload({
        file: new File([new Uint8Array(1_025)], 'too-large.pdf', {
          type: 'application/pdf',
        }),
      }).success,
    ).toBe(false)
  })
})
