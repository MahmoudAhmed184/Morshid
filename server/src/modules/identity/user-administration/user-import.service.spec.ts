import { UserImportService } from './user-import.service'
import type { UserImportRepository } from './user-import.repository'
import type { PasswordHasher } from '../password-hasher'

const actorId = '00000000-0000-4000-8000-000000000001'
const actor = { id: actorId } as never

describe(UserImportService.name, () => {
  const importId = '00000000-0000-4000-8000-000000000002'
  const storedImport = {
    id: importId,
    status: 'PENDING',
    createdAt: new Date('2026-08-16T00:00:00Z'),
    approvedAt: null,
    rows: [],
  } as never

  function harness(existingEmails: string[] = []) {
    const repository = {
      findExistingEmails: jest
        .fn()
        .mockResolvedValue(existingEmails.map((email) => ({ email }))),
      createImport: jest.fn().mockResolvedValue(storedImport),
      approveImport: jest.fn().mockResolvedValue(storedImport),
    } as unknown as jest.Mocked<UserImportRepository>
    const passwordHasher = {
      createHash: jest.fn((password: string) => `hashed:${password}`),
    } as unknown as PasswordHasher

    return {
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

  it('marks duplicate rows and existing users invalid without hashing', async () => {
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
    expect(rows.every((row) => row.passwordHash === null)).toBe(true)
    expect(rows[0].errors).toContain(
      'Email appears more than once in this import',
    )
    expect(rows[2].errors).toContain('A user with this email already exists')
  })

  it('delegates approval with the authenticated admin identity', async () => {
    const { repository, service } = harness()
    await service.approve(importId, actor)
    expect(repository.approveImport.mock.calls).toEqual([
      [importId, actorId, undefined],
    ])
  })
})
