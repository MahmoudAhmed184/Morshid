import { Inject, Injectable, Optional } from '@nestjs/common'
import { PDFParse, VerbosityLevel, type TextResult } from 'pdf-parse'

import {
  MATERIAL_PROCESSING_ERROR_CODES,
  SafeMaterialProcessingError,
} from './material-processing.errors'

export interface PdfTextExtractionWarning {
  code: string
  message: string
}

export interface PdfTextExtractionResult {
  text: string
  warnings: readonly PdfTextExtractionWarning[]
}

interface PdfTextParser {
  getText(): Promise<Pick<TextResult, 'text'>>
  destroy(): Promise<void>
}

export type PdfTextParserFactory = (contents: Buffer) => PdfTextParser

export const PDF_TEXT_PARSER_FACTORY = Symbol('PdfTextParserFactory')

@Injectable()
export class PdfTextExtractor {
  constructor(
    @Optional()
    @Inject(PDF_TEXT_PARSER_FACTORY)
    private readonly createParser: PdfTextParserFactory = createPdfParseParser,
  ) {}

  async extract(contents: Buffer): Promise<PdfTextExtractionResult> {
    let parser: PdfTextParser | null = null

    try {
      parser = this.createParser(contents)
      const result = await parser.getText()

      if (result.text.trim() === '') {
        throw new SafeMaterialProcessingError(
          MATERIAL_PROCESSING_ERROR_CODES.NO_EXTRACTABLE_TEXT,
        )
      }

      return {
        text: result.text,
        warnings: [],
      }
    } catch (error) {
      if (error instanceof SafeMaterialProcessingError) {
        throw error
      }

      throw new SafeMaterialProcessingError(
        MATERIAL_PROCESSING_ERROR_CODES.PDF_READ_FAILED,
      )
    } finally {
      if (parser !== null) {
        await parser.destroy()
      }
    }
  }
}

function createPdfParseParser(contents: Buffer): PdfTextParser {
  return new PDFParse({
    data: contents,
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
  })
}
