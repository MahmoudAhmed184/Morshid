import Papa from 'papaparse'

import type { CourseMembershipRole } from '@/features/courses/course-administration.schema'

const IDENTIFIER_HEADER_PATTERNS = [
  /^identifier$/i,
  /^email$/i,
  /^id$/i,
  /^user_?id$/i,
  /^student_?id$/i,
  /^instructor_?id$/i,
  /^student\s*id$/i,
  /^instructor\s*id$/i,
  /^user\s*id$/i,
]

export function parsePastedIdentifiers(text: string): string[] {
  if (!text.trim()) return []
  return text
    .split(/[\r\n,;\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export type ParsedCsvIdentifiers = {
  identifiers: string[]
  errors: string[]
}

export function parseCsvIdentifiers(file: File): Promise<ParsedCsvIdentifiers> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: ({ data, errors }) => {
        const parsingErrors = errors
          .filter(
            (error) =>
              error.code !== 'UndetectableDelimiter' &&
              error.type !== 'Delimiter',
          )
          .map((error) => `Row ${(error.row ?? 0) + 1}: ${error.message}`)

        if (data.length === 0) {
          return resolve({
            identifiers: [],
            errors: ['The CSV file does not contain any data.'],
          })
        }

        const firstRow = data[0] ?? []
        let targetColumnIndex = -1

        for (let i = 0; i < firstRow.length; i++) {
          const cell = (firstRow[i] ?? '')
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
          if (
            IDENTIFIER_HEADER_PATTERNS.some((pattern) => pattern.test(cell))
          ) {
            targetColumnIndex = i
            break
          }
        }

        const hasHeader = targetColumnIndex !== -1
        const rowsToProcess = hasHeader ? data.slice(1) : data
        const extracted: string[] = []

        for (const row of rowsToProcess) {
          if (row.length === 0) continue

          if (hasHeader) {
            const val = (row[targetColumnIndex] ?? '').trim()
            if (val.length > 0) extracted.push(val)
          } else {
            const firstNonEmpty = row
              .map((c) => c.trim())
              .find((c) => c.length > 0)
            if (firstNonEmpty !== undefined) extracted.push(firstNonEmpty)
          }
        }

        if (extracted.length === 0) {
          parsingErrors.push('The CSV file does not contain any identifiers.')
        }

        if (extracted.length > 1_000) {
          parsingErrors.push(
            'A single bulk assignment can contain at most 1,000 identifiers.',
          )
        }

        resolve({
          identifiers: extracted,
          errors: parsingErrors,
        })
      },
      error: (error) => resolve({ identifiers: [], errors: [error.message] }),
    })
  })
}

export function downloadBulkAssignmentTemplate(role: CourseMembershipRole) {
  const userType = role === 'STUDENT' ? 'student' : 'instructor'
  const template = Papa.unparse([
    { identifier: `${userType}1@morshid.demo` },
    { identifier: `${userType}2@morshid.demo` },
    { identifier: '10000000-0000-4000-8000-000000000001' },
  ])

  const blob = new Blob([template], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `morshid-bulk-${userType}-assignment-template.csv`
  link.click()
  URL.revokeObjectURL(url)
}
