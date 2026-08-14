import { describe, expect, it } from 'vitest'

import { parseUserImport, userImportTemplate } from './user-import.csv'

describe('user CSV import', () => {
  it('provides a template with the required columns', () => {
    expect(userImportTemplate.split('\r\n')[0]).toBe(
      'displayName,email,password',
    )
  })

  it('parses quoted names and applies the directory role', async () => {
    const file = new File(
      ['displayName,email,password\n"Doe, Jane",JANE@EXAMPLE.COM,StrongPass1!'],
      'students.csv',
      { type: 'text/csv' },
    )

    await expect(parseUserImport(file, 'STUDENT')).resolves.toEqual({
      users: [
        {
          displayName: 'Doe, Jane',
          email: 'jane@example.com',
          password: 'StrongPass1!',
          role: 'STUDENT',
        },
      ],
      errors: [],
    })
  })

  it('rejects missing columns and duplicate emails before upload', async () => {
    const missingColumnFile = new File(
      ['displayName,email\nJane,jane@example.com'],
      'invalid.csv',
    )
    const duplicateFile = new File(
      [
        'displayName,email,password\nJane,jane@example.com,StrongPass1!\nJanet,JANE@example.com,StrongPass2!',
      ],
      'duplicates.csv',
    )

    const missingColumns = await parseUserImport(missingColumnFile, 'STUDENT')
    const duplicates = await parseUserImport(duplicateFile, 'STUDENT')

    expect(missingColumns.errors).toContain(
      'Missing required column(s): password',
    )
    expect(duplicates.errors).toContain(
      'Row 3: Email appears more than once in this file.',
    )
  })
})
