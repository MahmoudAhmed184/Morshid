import {
  cleanTextPdf,
  emptyPdf,
  imageOnlyPdf,
} from '../../../test/fixtures/pdf-fixtures'
import { PdfExtractionError, PdfJsTextExtractor } from './pdf-text-extractor'

describe('PdfJsTextExtractor', () => {
  const extractor = new PdfJsTextExtractor()

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
})
