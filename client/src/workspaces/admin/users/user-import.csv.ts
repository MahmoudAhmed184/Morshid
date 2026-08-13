import Papa from 'papaparse'

import { createUserFormSchema } from '@/features/user-management/managed-user.schema'
import type { CreateManagedUserInput } from '@/features/user-management/user-management.api'

const csvHeaders = ['displayName', 'email', 'password'] as const

export const userImportTemplate = Papa.unparse([
  {
    displayName: 'Example User',
    email: 'user@example.com',
    password: 'ChangeMe1!',
  },
])

export type ParsedUserImport =
  | { users: CreateManagedUserInput[]; errors: [] }
  | { users: []; errors: string[] }

export function parseUserImport(
  file: File,
  role: CreateManagedUserInput['role'],
): Promise<ParsedUserImport> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
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

        const seenEmails = new Set<string>()
        const users = data.flatMap((row, index) => {
          const result = createUserFormSchema.safeParse({
            name: row.displayName,
            email: row.email,
            password: row.password,
            role,
          })

          if (!result.success) {
            validationErrors.push(
              `Row ${index + 2}: ${result.error.issues.map((issue) => issue.message).join(' ')}`,
            )
            return []
          }

          if (seenEmails.has(result.data.email)) {
            validationErrors.push(
              `Row ${index + 2}: Email appears more than once in this file.`,
            )
            return []
          }

          seenEmails.add(result.data.email)
          return [
            {
              displayName: result.data.name,
              email: result.data.email,
              password: result.data.password,
              role: result.data.role,
            },
          ]
        })

        if (data.length === 0) {
          validationErrors.push('The CSV file does not contain any users.')
        }

        resolve(
          validationErrors.length > 0
            ? { users: [], errors: validationErrors }
            : { users, errors: [] },
        )
      },
      error: (error) => resolve({ users: [], errors: [error.message] }),
    })
  })
}

export function downloadUserImportTemplate() {
  const blob = new Blob([userImportTemplate], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'morshid-user-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}
