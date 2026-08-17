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
      rows: [
        {
          rowNumber: 2,
          displayName: 'Doe, Jane',
          email: 'JANE@EXAMPLE.COM',
          password: 'StrongPass1!',
          role: 'STUDENT',
        },
      ],
      errors: [],
    })
  })

  it('retains rows when columns are missing so the backend can stage them', async () => {
    const missingColumnFile = new File(
      ['displayName,email\nJane,jane@example.com'],
      'invalid.csv',
    )
    const missingColumns = await parseUserImport(missingColumnFile, 'STUDENT')

    expect(missingColumns.errors).toContain(
      'Missing required column(s): password',
    )
    expect(missingColumns.rows).toHaveLength(1)
    expect(missingColumns.rows[0]?.password).toBe('')
  })
})
