import { z } from 'zod'

import { DEBUGGING_GUIDANCE_CATEGORIES } from './debugging-guidance.contract'

export const DEBUGGING_GUIDANCE_LOCATION_HINTS = [
  'FUNCTION_HEADER',
  'FUNCTION_BODY',
  'RETURN_EXPRESSION',
  'LOOP_HEADER',
  'LOOP_BODY',
  'INDEX_EXPRESSION',
  'FUNCTION_CALL',
  'DICTIONARY_LOOKUP',
  'STRING_EXPRESSION',
  'FILE_PATH_LITERAL',
] as const

export const DEBUGGING_GUIDANCE_DIAGNOSTIC_SIGNALS = [
  'MISSING_BLOCK_COLON',
  'POSSIBLE_IDENTIFIER_MISMATCH',
  'UNRESOLVED_IDENTIFIER',
  'INDEX_EQUALS_COLLECTION_LENGTH',
  'BLOCK_INDENTATION_MISMATCH',
  'ARGUMENT_COUNT_MISMATCH',
  'MISSING_DICTIONARY_KEY',
  'INCOMPATIBLE_STRING_OPERANDS',
  'BACKSLASH_ESCAPE_IN_PATH',
] as const

const identifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,30}$/u)

export const debuggingGuidanceRetrievalQueryInputSchema = z
  .object({
    suspectedCategory: z.enum(DEBUGGING_GUIDANCE_CATEGORIES),
    locationHint: z.enum(DEBUGGING_GUIDANCE_LOCATION_HINTS),
    diagnosticSignals: z
      .array(z.enum(DEBUGGING_GUIDANCE_DIAGNOSTIC_SIGNALS))
      .min(1)
      .max(5),
    relevantIdentifiers: z.array(identifierSchema).max(2),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.diagnosticSignals).size !== input.diagnosticSignals.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Diagnostic signals must be unique',
        path: ['diagnosticSignals'],
      })
    }
    if (
      new Set(input.relevantIdentifiers).size !==
      input.relevantIdentifiers.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Relevant identifiers must be unique',
        path: ['relevantIdentifiers'],
      })
    }

    const namesAreUseful =
      input.suspectedCategory === 'NAME_LOOKUP' &&
      input.diagnosticSignals.some(
        (signal) =>
          signal === 'POSSIBLE_IDENTIFIER_MISMATCH' ||
          signal === 'UNRESOLVED_IDENTIFIER',
      )
    if (input.relevantIdentifiers.length > 0 && !namesAreUseful) {
      context.addIssue({
        code: 'custom',
        message:
          'Identifiers may appear only when diagnostically useful to name lookup',
        path: ['relevantIdentifiers'],
      })
    }
  })

export type DebuggingGuidanceRetrievalQueryInput = z.infer<
  typeof debuggingGuidanceRetrievalQueryInputSchema
>

const CATEGORY_QUERY_TEXT = {
  SYNTAX: 'a possible syntax delimiter issue',
  NAME_LOOKUP: 'a possible variable-name mismatch or unresolved name',
  INDEX_ACCESS: 'a possible out-of-range index access',
  LOOP_OR_INDENTATION: 'a possible loop-block or indentation issue',
  FUNCTION_USAGE: 'a possible function-call or parameter mismatch',
  DICTIONARY_ACCESS: 'a possible missing-key dictionary access',
  STRING_HANDLING: 'a possible incompatible string operation',
  FILE_HANDLING: 'a possible file-path or file-handling issue',
} as const satisfies Record<
  DebuggingGuidanceRetrievalQueryInput['suspectedCategory'],
  string
>

const CATEGORY_CONCEPT_TEXT = {
  SYNTAX: 'block syntax and required delimiters',
  NAME_LOOKUP: 'name lookup and local scope',
  INDEX_ACCESS: 'zero-based indexes and collection bounds',
  LOOP_OR_INDENTATION: 'loop suites and indentation-defined blocks',
  FUNCTION_USAGE: 'parameters, arguments, and function calls',
  DICTIONARY_ACCESS: 'dictionary keys and bracket lookup',
  STRING_HANDLING: 'string operands and type compatibility',
  FILE_HANDLING: 'path string literals and file handling',
} as const satisfies Record<
  DebuggingGuidanceRetrievalQueryInput['suspectedCategory'],
  string
>

const LOCATION_QUERY_TEXT = {
  FUNCTION_HEADER: 'the function header',
  FUNCTION_BODY: 'the function body',
  RETURN_EXPRESSION: 'the return expression',
  LOOP_HEADER: 'the loop header',
  LOOP_BODY: 'the loop body',
  INDEX_EXPRESSION: 'the index expression',
  FUNCTION_CALL: 'the function call',
  DICTIONARY_LOOKUP: 'the dictionary lookup',
  STRING_EXPRESSION: 'the string expression',
  FILE_PATH_LITERAL: 'the file-path literal',
} as const satisfies Record<
  DebuggingGuidanceRetrievalQueryInput['locationHint'],
  string
>

const SIGNAL_QUERY_TEXT = {
  MISSING_BLOCK_COLON: 'a required block colon may be missing',
  POSSIBLE_IDENTIFIER_MISMATCH: 'singular and plural identifiers may not match',
  UNRESOLVED_IDENTIFIER: 'a referenced identifier may not be defined',
  INDEX_EQUALS_COLLECTION_LENGTH: 'the index may equal the collection length',
  BLOCK_INDENTATION_MISMATCH:
    'a statement may be outside its intended indented block',
  ARGUMENT_COUNT_MISMATCH:
    'the supplied arguments may not match required parameters',
  MISSING_DICTIONARY_KEY: 'the requested key may be absent from the dictionary',
  INCOMPATIBLE_STRING_OPERANDS:
    'the string operation may combine incompatible operand types',
  BACKSLASH_ESCAPE_IN_PATH:
    'the path literal may contain interpreted backslash escapes',
} as const satisfies Record<
  DebuggingGuidanceRetrievalQueryInput['diagnosticSignals'][number],
  string
>

export function buildDebuggingGuidanceRetrievalQuery(value: unknown): string {
  const input = debuggingGuidanceRetrievalQueryInputSchema.parse(value)
  const problem = CATEGORY_QUERY_TEXT[input.suspectedCategory]
  const location = LOCATION_QUERY_TEXT[input.locationHint]
  const concept = CATEGORY_CONCEPT_TEXT[input.suspectedCategory]
  const signals = input.diagnosticSignals
    .map((signal) => SIGNAL_QUERY_TEXT[signal])
    .join('; ')
  const identifiers =
    input.relevantIdentifiers.length === 0
      ? ''
      : ` Relevant identifiers: ${input.relevantIdentifiers.join(', ')}.`

  return `Code ${problem} near ${location}; study ${concept}. Diagnostic signals: ${signals}.${identifiers}`
}
