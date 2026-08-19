import { UserImportService } from './user-import.service'
import type {
  UserImportRecord,
  UserImportRepository,
  UpdatedUserImportRow,
} from './user-import.repository'
import type { AuthenticatedUser } from '../identity.types'
import type { PasswordHasher } from '../password-hasher'

const actorId = '00000000-0000-4000-8000-000000000001'
const actor: AuthenticatedUser = {
  id: actorId,
  email: 'admin@morshid.demo',
  displayName: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  universityId: '00000000-0000-4000-8000-000000000000',
}

describe(UserImportService.name, () => {
  const importId = '00000000-0000-4000-8000-000000000002'
  const storedImport = {
    id: importId,
    status: 'PENDING',
    createdAt: new Date('2026-08-16T00:00:00Z'),
    approvedAt: null,
    rows: [],
  } as unknown as UserImportRecord

  function harness(
    existingEmails: string[] = [],
    imported: UserImportRecord = storedImport,
  ) {
    const updateRows = jest.fn((_id: string, rows: UpdatedUserImportRow[]) =>
      Promise.resolve({
        ...imported,
        rows: rows.map((row) => ({
          ...row,
          status: row.errors.length === 0 ? 'VALID' : 'INVALID',
        })),
      } as UserImportRecord),
    )
    const repository = {
      findExistingEmails: jest
        .fn()
        .mockResolvedValue(existingEmails.map((email) => ({ email }))),
      createImport: jest.fn().mockResolvedValue(storedImport),
      approveImport: jest.fn().mockResolvedValue(storedImport),
      findImport: jest.fn().mockResolvedValue(imported),
      updateRows,
      cancelRow: jest.fn().mockResolvedValue(imported),
    } as unknown as jest.Mocked<UserImportRepository>
    const createHash = jest.fn((password: string) => `hashed:${password}`)
    const passwordHasher = { createHash } as unknown as PasswordHasher

    return {
      createHash,
      repository,
      service: new UserImportService(repository, passwordHasher),
    }
  }

  it('stages valid rows with hashes and invalid rows with visible reasons', async () => {
    const { repository, service } = harness()
    await service.create(
      {
        rows: [
          {
            rowNumber: 2,
            displayName: 'Valid Student',
            email: 'valid@example.com',
            password: 'a secure passphrase',
            role: 'STUDENT',
          },
          {
            rowNumber: 3,
            displayName: '',
            email: 'not-email',
            password: 'short',
            role: 'OTHER',
          },
        ],
      },
      actor,
    )

    const rows = repository.createImport.mock.calls[0][1]
    expect(rows[0]).toMatchObject({
      email: 'valid@example.com',
      passwordHash: 'hashed:a secure passphrase',
      errors: [],
    })
    expect(rows[1].passwordHash).toBeNull()
    expect(rows[1].errors.length).toBeGreaterThan(0)
  })

  it('marks duplicate rows and existing users invalid while retaining secured passwords', async () => {
    const { repository, service } = harness(['existing@example.com'])
    await service.create(
      {
        rows: [
          ...[2, 3].map((rowNumber) => ({
            rowNumber,
            displayName: 'Duplicate',
            email: 'DUP@example.com',
            password: 'a secure passphrase',
            role: 'STUDENT',
          })),
          {
            rowNumber: 4,
            displayName: 'Existing',
            email: 'existing@example.com',
            password: 'another secure passphrase',
            role: 'INSTRUCTOR',
          },
        ],
      },
      actor,
    )

    const rows = repository.createImport.mock.calls[0][1]
    expect(
      rows.every((row) => row.passwordHash?.startsWith('hashed:') ?? false),
    ).toBe(true)
    expect(rows[0].errors).toContain(
      'Email appears more than once in this import',
    )
    expect(rows[2].errors).toContain('A user with this email already exists')
  })

  it('edits a pending row, hashes a replacement password, and revalidates it', async () => {
    const imported = {
      ...storedImport,
      rows: [
        {
          id: 'row-1',
          rowNumber: 2,
          displayName: null,
          email: 'old@example.com',
          role: 'STUDENT',
          passwordHash: null,
          status: 'INVALID',
          errors: ['Name is required'],
        },
      ],
    } as unknown as UserImportRecord
    const { repository, service } = harness([], imported)

    const result = await service.updateRow(importId, 'row-1', {
      displayName: 'Edited Student',
      email: 'edited@example.com',
      password: 'a replacement passphrase',
    })

    const updatedRows = repository.updateRows.mock.calls[0][1]
    expect(updatedRows[0]).toMatchObject({
      displayName: 'Edited Student',
      email: 'edited@example.com',
      passwordHash: 'hashed:a replacement passphrase',
      errors: [],
    })
    expect(result.userImport.rows[0]).not.toHaveProperty('passwordHash')
    expect(result.userImport.rows[0]).not.toHaveProperty('password')
    expect(result.userImport.rows[0]).toHaveProperty('hasPassword', true)
  })

  it('keeps the staged password hash when an edit omits the password', async () => {
    const imported = {
      ...storedImport,
      rows: [
        {
          id: 'row-1',
          rowNumber: 2,
          displayName: 'Original Student',
          email: 'student@example.com',
          role: 'STUDENT',
          passwordHash: 'existing-secured-hash',
          status: 'VALID',
          errors: [],
        },
      ],
    } as unknown as UserImportRecord
    const { createHash, repository, service } = harness([], imported)

    await service.updateRow(importId, 'row-1', {
      displayName: 'Edited Student',
    })

    expect(repository.updateRows.mock.calls[0][1][0].passwordHash).toBe(
      'existing-secured-hash',
    )
    expect(createHash).not.toHaveBeenCalled()
  })

  it('replaces a generic staged password error with the exact policy error', async () => {
    const imported = {
      ...storedImport,
      rows: [
        {
          id: 'row-1',
          rowNumber: 2,
          displayName: null,
          email: 'student@example.com',
          role: 'STUDENT',
          passwordHash: null,
          status: 'INVALID',
          errors: ['Password: Enter a password that meets the password policy'],
        },
      ],
    } as unknown as UserImportRecord
    const { repository, service } = harness([], imported)

    await service.updateRow(importId, 'row-1', {
      displayName: 'Edited Student',
    })

    expect(repository.updateRows.mock.calls[0][1][0].errors).toContain(
      'Password: Password must be at least 15 characters',
    )
    expect(repository.updateRows.mock.calls[0][1][0].errors).not.toContain(
      'Password: Enter a password that meets the password policy',
    )
  })

  it('marks duplicate and existing edited emails invalid', async () => {
    const imported = {
      ...storedImport,
      rows: ['row-1', 'row-2'].map((id, index) => ({
        id,
        rowNumber: index + 2,
        displayName: 'Student',
        email: `${id}@example.com`,
        role: 'STUDENT',
        passwordHash: 'secured',
        status: 'VALID',
        errors: [],
      })),
    } as unknown as UserImportRecord
    const { repository, service } = harness(['taken@example.com'], imported)

    await service.updateRow(importId, 'row-1', { email: 'taken@example.com' })
    expect(repository.updateRows.mock.calls[0][1][0].errors).toContain(
      'Email: A user with this email already exists',
    )

    await service.updateRow(importId, 'row-1', { email: 'row-2@example.com' })
    expect(repository.updateRows.mock.calls[1][1][0].errors).toContain(
      'Email: Email appears more than once in this import',
    )
  })

  it('delegates approval with the authenticated admin identity', async () => {
    const { repository, service } = harness()
    await service.approve(importId, actor)
    expect(repository.approveImport.mock.calls).toEqual([
      [importId, actorId, actor.universityId, undefined],
    ])
  })

  it('cancels a pending row and leaves the staged record visible', async () => {
    const imported = {
      ...storedImport,
      rows: [
        {
          id: 'row-1',
          rowNumber: 2,
          displayName: 'First',
          email: 'first@example.com',
          role: 'STUDENT',
          passwordHash: 'secured',
          status: 'VALID',
          errors: [],
        },
        {
          id: 'row-2',
          rowNumber: 3,
          displayName: 'Second',
          email: 'second@example.com',
          role: 'STUDENT',
          passwordHash: 'secured',
          status: 'VALID',
          errors: [],
        },
      ],
    } as unknown as UserImportRecord
    const cancelled = {
      ...imported,
      rows: imported.rows.map((row) =>
        row.id === 'row-1' ? { ...row, status: 'CANCELLED' as const } : row,
      ),
    }
    const { repository, service } = harness([], imported)
    repository.cancelRow.mockResolvedValue(cancelled)
    repository.updateRows.mockResolvedValue(cancelled)

    const result = await service.cancelRow(importId, 'row-1')

    expect(repository.cancelRow.mock.calls).toEqual([[importId, 'row-1']])
    expect(repository.updateRows.mock.calls).toHaveLength(1)
    expect(result.userImport.rows).toHaveLength(2)
    expect(result.userImport.rows[0]?.status).toBe('CANCELLED')
    expect(result.userImport.rows[1]?.status).toBe('VALID')
  })

  it('revalidates a duplicate-email row after its duplicate is cancelled', async () => {
    const duplicateError = 'Email: Email appears more than once in this import'
    const imported = {
      ...storedImport,
      rows: ['row-1', 'row-2'].map((id, index) => ({
        id,
        rowNumber: index + 2,
        displayName: `Student ${(index + 1).toString()}`,
        email: 'shared@example.com',
        role: 'STUDENT',
        passwordHash: 'secured',
        status: 'INVALID',
        errors: [duplicateError],
      })),
    } as unknown as UserImportRecord
    const cancelled = {
      ...imported,
      rows: imported.rows.map((candidate) =>
        candidate.id === 'row-1'
          ? { ...candidate, status: 'CANCELLED' as const }
          : candidate,
      ),
    }
    const revalidated = {
      ...cancelled,
      rows: cancelled.rows.map((candidate) =>
        candidate.id === 'row-2'
          ? { ...candidate, status: 'VALID' as const, errors: [] }
          : candidate,
      ),
    }
    const { repository, service } = harness([], imported)
    repository.cancelRow.mockResolvedValue(cancelled)
    repository.updateRows.mockResolvedValue(revalidated)

    const result = await service.cancelRow(importId, 'row-1')

    expect(repository.updateRows.mock.calls).toEqual([
      [
        importId,
        [
          expect.objectContaining({
            id: 'row-2',
            email: 'shared@example.com',
            errors: [],
          }),
        ],
      ],
    ])
    expect(result.userImport.rows[1]).toMatchObject({
      id: 'row-2',
      status: 'VALID',
      errors: [],
    })
  })

  it.each(['APPROVED', 'CANCELLED'] as const)(
    'does not cancel a %s row again',
    async (status) => {
      const imported = {
        ...storedImport,
        rows: [
          {
            id: 'row-1',
            rowNumber: 2,
            displayName: 'Student',
            email: 'student@example.com',
            role: 'STUDENT',
            passwordHash: 'secured',
            status,
            errors: [],
          },
        ],
      } as unknown as UserImportRecord
      const { repository, service } = harness([], imported)

      await expect(service.cancelRow(importId, 'row-1')).rejects.toThrow(
        'cannot be removed',
      )
      expect(repository.cancelRow.mock.calls).toHaveLength(0)
    },
  )
})
