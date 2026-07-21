import { Inject, Injectable } from '@nestjs/common'
import type { PDFDocumentLoadingTask } from 'pdfjs-dist/legacy/build/pdf.mjs'

export const PDF_TEXT_EXTRACTOR = Symbol('PdfTextExtractor')
export const PDF_DOCUMENT_LOADER = Symbol('PdfDocumentLoader')

export interface PdfTextExtractionResult {
  text: string
  warnings: string[]
}

export interface PdfTextExtractor {
  extract(contents: Buffer): Promise<PdfTextExtractionResult>
}

export interface PdfDocumentLoader {
  load(contents: Buffer): Promise<PDFDocumentLoadingTask>
}

export class PdfExtractionError extends Error {
  constructor() {
    super('PDF text extraction failed')
    this.name = 'PdfExtractionError'
  }
}

@Injectable()
export class PdfJsDocumentLoader implements PdfDocumentLoader {
  async load(contents: Buffer): Promise<PDFDocumentLoadingTask> {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    return getDocument({
      data: new Uint8Array(contents),
      verbosity: 0,
    })
  }
}

@Injectable()
export class PdfJsTextExtractor implements PdfTextExtractor {
  constructor(
    @Inject(PDF_DOCUMENT_LOADER)
    private readonly documentLoader: PdfDocumentLoader,
  ) {}

  async extract(contents: Buffer): Promise<PdfTextExtractionResult> {
    let loadingTask: PDFDocumentLoadingTask | undefined

    try {
      loadingTask = await this.documentLoader.load(contents)
      const document = await loadingTask.promise
      const pageCount = document.numPages
      const pages: string[] = []
      let pagesWithoutText = 0

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const textContent = await page.getTextContent({
          disableNormalization: false,
        })
        const pageText = textContent.items
          .map((item) => {
            if (!('str' in item)) {
              return ''
            }

            return `${item.str}${item.hasEOL ? '\n' : ' '}`
          })
          .join('')
          .trim()

        if (pageText.length === 0) {
          pagesWithoutText += 1
        }
        pages.push(pageText)
        page.cleanup()
      }

      await document.cleanup()

      return {
        text: pages.join('\n\n'),
        warnings:
          pagesWithoutText > 0 && pagesWithoutText < pageCount
            ? ['PARTIAL_PAGE_TEXT']
            : [],
      }
    } catch {
      throw new PdfExtractionError()
    } finally {
      await loadingTask?.destroy().catch(() => undefined)
    }
  }
}
