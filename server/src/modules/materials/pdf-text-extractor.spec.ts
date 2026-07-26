import {
  cleanTextPdf,
  emptyPdf,
  imageOnlyPdf,
} from '../../../test/fixtures/pdf-fixtures'
import {
  PdfExtractionError,
  PdfJsDocumentLoader,
  PdfJsTextExtractor,
  type PdfDocumentLoader,
} from './pdf-text-extractor'

describe('PdfJsTextExtractor', () => {
  const extractor = new PdfJsTextExtractor(new PdfJsDocumentLoader())

  it('extracts deterministic text from a clean text PDF', async () => {
    await expect(
      extractor.extract(cleanTextPdf('Synthetic variables')),
    ).resolves.toEqual({
      text: 'Synthetic variables',
      warnings: [],
    })
  })

  it.each([emptyPdf(), imageOnlyPdf()])(
    'returns empty text for PDFs without an extractable text layer',
    async (fixture) => {
      await expect(extractor.extract(fixture)).resolves.toMatchObject({
        text: '',
      })
    },
  )

  it('rejects malformed PDF bytes with a safe typed error', async () => {
    await expect(
      extractor.extract(Buffer.from('%PDF-1.7\nnot a complete document')),
    ).rejects.toBeInstanceOf(PdfExtractionError)
  })

  it('destroys the loading task after successful extraction', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined)
    const document = {
      numPages: 1,
      getPage: jest.fn().mockResolvedValue({
        getTextContent: jest.fn().mockResolvedValue({
          items: [{ str: 'extracted', hasEOL: false }],
        }),
        cleanup: jest.fn(),
      }),
      cleanup: jest.fn().mockResolvedValue(undefined),
    }
    const loader = {
      load: jest.fn().mockResolvedValue({
        promise: Promise.resolve(document),
        destroy,
      }),
    } as unknown as PdfDocumentLoader

    await expect(
      new PdfJsTextExtractor(loader).extract(Buffer.from('pdf')),
    ).resolves.toMatchObject({ text: 'extracted' })
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys the loading task after extraction failure without replacing the safe error', async () => {
    const destroy = jest.fn().mockRejectedValue(new Error('destroy failed'))
    const loader = {
      load: jest.fn().mockResolvedValue({
        promise: Promise.reject(new Error('parser sentinel')),
        destroy,
      }),
    } as unknown as PdfDocumentLoader

    await expect(
      new PdfJsTextExtractor(loader).extract(Buffer.from('pdf')),
    ).rejects.toBeInstanceOf(PdfExtractionError)
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
