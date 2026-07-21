import {
  PdfTextExtractor,
  type PdfTextParserFactory,
} from './pdf-text.extractor'
import {
  MATERIAL_PROCESSING_ERROR_CODES,
  SafeMaterialProcessingError,
} from './material-processing.errors'

function buildExtractor(input: {
  text?: string
  failure?: Error
  destroyFailure?: Error
}) {
  const getText = jest.fn(() => {
    if (input.failure !== undefined) {
      return Promise.reject(input.failure)
    }

    return Promise.resolve({ text: input.text ?? 'Python text' })
  })
  const destroy = jest.fn(() => {
    if (input.destroyFailure !== undefined) {
      return Promise.reject(input.destroyFailure)
    }

    return Promise.resolve()
  })
  const createParser: PdfTextParserFactory = jest.fn(() => ({
    getText,
    destroy,
  }))

  return {
    extractor: new PdfTextExtractor(createParser),
    createParser,
    getText,
    destroy,
  }
}

describe('PdfTextExtractor', () => {
  const pdfBytes = Buffer.from('%PDF-1.7\nclean text pdf')

  it('extracts clean text and destroys the parser', async () => {
    const { extractor, createParser, getText, destroy } = buildExtractor({
      text: 'Python variables store values.',
    })

    await expect(extractor.extract(pdfBytes)).resolves.toEqual({
      text: 'Python variables store values.',
      warnings: [],
    })
    expect(createParser).toHaveBeenCalledWith(pdfBytes)
    expect(getText).toHaveBeenCalledTimes(1)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it.each(['', '   ', '\n\t  '])(
    'treats empty extraction as scanned or unsupported PDF text %j',
    async (text) => {
      const { extractor, destroy } = buildExtractor({ text })

      await expect(extractor.extract(pdfBytes)).rejects.toMatchObject({
        code: MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT,
        message:
          'No extractable text was found. Scanned PDFs are not supported.',
      } satisfies Partial<SafeMaterialProcessingError>)
      expect(destroy).toHaveBeenCalledTimes(1)
    },
  )

  it('converts parser failures to a safe PDF read error', async () => {
    const { extractor } = buildExtractor({
      failure: new Error('/absolute/path.pdf leaked parser stack'),
    })

    const failure = await extractor.extract(pdfBytes).then(
      () => null,
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(SafeMaterialProcessingError)
    expect(failure).toMatchObject({
      code: MATERIAL_PROCESSING_ERROR_CODES.PDF_READ_FAILED,
      message: 'The PDF could not be read.',
    })
    expect((failure as Error).message).not.toContain('/absolute/path.pdf')
  })

  it('destroys the parser after parser failures', async () => {
    const { extractor, destroy } = buildExtractor({
      failure: new Error('parser failed'),
    })

    await expect(extractor.extract(pdfBytes)).rejects.toBeInstanceOf(
      SafeMaterialProcessingError,
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
