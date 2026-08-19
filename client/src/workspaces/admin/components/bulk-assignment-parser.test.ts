import { describe, expect, it, vi } from 'vitest'

import {
  downloadBulkAssignmentTemplate,
  parseCsvIdentifiers,
  parsePastedIdentifiers,
} from './bulk-assignment-parser'

describe('bulk-assignment-parser', () => {
  describe('parsePastedIdentifiers', () => {
    it('returns empty array for blank or whitespace-only input', () => {
      expect(parsePastedIdentifiers('')).toEqual([])
      expect(parsePastedIdentifiers('   \n\t  \n  ')).toEqual([])
    })

    it('parses identifiers separated by newlines, commas, semicolons, and tabs', () => {
      const input = `
        student1@morshid.demo, student2@morshid.demo;
        10000000-0000-4000-8000-000000000001	student3@morshid.demo

        student4@morshid.demo
      `
      const result = parsePastedIdentifiers(input)
      expect(result).toEqual([
        'student1@morshid.demo',
        'student2@morshid.demo',
        '10000000-0000-4000-8000-000000000001',
        'student3@morshid.demo',
        'student4@morshid.demo',
      ])
    })
  })

  describe('parseCsvIdentifiers', () => {
    it('returns an error if file is empty', async () => {
      const file = new File([''], 'empty.csv', { type: 'text/csv' })
      const result = await parseCsvIdentifiers(file)
      expect(result.identifiers).toEqual([])
      expect(result.errors).toContain('The CSV file does not contain any data.')
    })

    it('parses single column without header', async () => {
      const csv = 'student1@morshid.demo\nstudent2@morshid.demo\n'
      const file = new File([csv], 'students.csv', { type: 'text/csv' })
      const result = await parseCsvIdentifiers(file)
      expect(result.errors).toEqual([])
      expect(result.identifiers).toEqual([
        'student1@morshid.demo',
        'student2@morshid.demo',
      ])
    })

    it('parses CSV with recognized header (email, id, identifier, studentId, instructorId)', async () => {
      const csv =
        'Name,Email,Department\nAlice,student1@morshid.demo,CS\nBob,student2@morshid.demo,Math\n'
      const file = new File([csv], 'students.csv', { type: 'text/csv' })
      const result = await parseCsvIdentifiers(file)
      expect(result.errors).toEqual([])
      expect(result.identifiers).toEqual([
        'student1@morshid.demo',
        'student2@morshid.demo',
      ])
    })

    it('handles UTF-8 BOM in CSV header', async () => {
      const csv =
        '\uFEFFidentifier\nstudent1@morshid.demo\nstudent2@morshid.demo'
      const file = new File([csv], 'students.csv', { type: 'text/csv' })
      const result = await parseCsvIdentifiers(file)
      expect(result.errors).toEqual([])
      expect(result.identifiers).toEqual([
        'student1@morshid.demo',
        'student2@morshid.demo',
      ])
    })

    it('returns error when exceeding 1,000 identifiers', async () => {
      const lines = [
        'identifier',
        ...Array.from({ length: 1001 }, (_, i) => `user${i}@morshid.demo`),
      ]
      const file = new File([lines.join('\n')], 'huge.csv', {
        type: 'text/csv',
      })
      const result = await parseCsvIdentifiers(file)
      expect(result.errors).toContain(
        'A single bulk assignment can contain at most 1,000 identifiers.',
      )
    })
  })

  describe('downloadBulkAssignmentTemplate', () => {
    it('creates a download link and triggers click for student role', () => {
      const createObjectURLMock = vi.fn(() => 'blob:test-url')
      const revokeObjectURLMock = vi.fn()
      window.URL.createObjectURL = createObjectURLMock
      window.URL.revokeObjectURL = revokeObjectURLMock

      const clickMock = vi.fn()
      const createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue({
          set href(_val: string) {},
          set download(_val: string) {},
          click: clickMock,
        } as unknown as HTMLAnchorElement)

      downloadBulkAssignmentTemplate('STUDENT')

      expect(createObjectURLMock).toHaveBeenCalledTimes(1)
      expect(clickMock).toHaveBeenCalledTimes(1)
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')

      createElementSpy.mockRestore()
    })
  })
})
