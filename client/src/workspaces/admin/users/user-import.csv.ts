import Papa from 'papaparse'

import type {
  CreateManagedUserInput,
  CreateUserImportRow,
} from '@/features/user-management/user-management.api'

const csvHeaders = ['displayName', 'email', 'password'] as const

export const userImportTemplate = Papa.unparse([
  {
    displayName: 'Example User',
    email: 'user@example.com',
    password: 'ChangeMeSecurePassphrase',
  },
])

export type ParsedUserImport = { rows: CreateUserImportRow[]; errors: string[] }

export function parseUserImport(
  file: File,
  role: CreateManagedUserInput['role'],
): Promise<ParsedUserImport> {
  return new Promise((resolve) => {
    Papa.parse<Partial<Record<string, string>>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: ({ data, errors, meta }) => {
        const validationErrors = errors.map(
          (error) => `Row ${(error.row ?? 0) + 2}: ${error.message}`,
        )
        const missingHeaders = csvHeaders.filter(
          (header) => !meta.fields?.includes(header),
        )

        if (missingHeaders.length > 0) {
          validationErrors.push(
            `Missing required column(s): ${missingHeaders.join(', ')}`,
          )
        }

        if (data.length > 200) {
          validationErrors.push(
            'A single import can contain at most 200 users.',
          )
        }

        const rows = data.map((row, index) => ({
          rowNumber: index + 2,
          displayName: row.displayName ?? '',
          email: row.email ?? '',
          password: row.password ?? '',
          role,
        }))

        if (data.length === 0) {
          validationErrors.push('The CSV file does not contain any users.')
        }

        resolve({ rows, errors: validationErrors })
      },
      error: (error) => resolve({ rows: [], errors: [error.message] }),
    })
  })
}

export function downloadUserImportTemplate(
  role: CreateManagedUserInput['role'],
) {
  const blob = new Blob([userImportTemplate], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `morshid-${role.toLowerCase()}-import-template.csv`
  link.click()
  URL.revokeObjectURL(url)
}
