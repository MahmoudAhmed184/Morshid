import { UserImportRepository } from './user-import.repository'
import type { PrismaService } from '../../../platform/database/prisma.service'
import type { UserAdministrationAuditService } from './user-administration-audit'

describe(UserImportRepository.name, () => {
  it('approves valid rows atomically, creates active users, and records audit events', async () => {
    const pendingImport = {
      status: 'PENDING',
      rows: [
        {
          id: 'row-1',
          email: 'student@example.com',
          displayName: 'Student',
          role: 'STUDENT',
          passwordHash: 'secured-hash',
          status: 'VALID',
        },
        {
          id: 'row-2',
          email: 'cancelled@example.com',
          displayName: 'Cancelled',
          role: 'STUDENT',
          passwordHash: 'cancelled-hash',
          status: 'CANCELLED',
        },
      ],
    }
    const approvedImport = {
      id: 'import-1',
      status: 'APPROVED',
      createdAt: new Date(),
      approvedAt: new Date(),
      rows: [],
    }
    const createUser = jest.fn(
      (input: {
        data: {
          email: string
          displayName: string
          role: string
          status: string
          passwordHash: string
        }
      }) => Promise.resolve({ id: 'user-1', ...input.data }),
    )
    const updateImport = jest.fn(
      (input: {
        where: { id: string }
        data: { status: string; approvedAt: Date }
      }) => Promise.resolve(input),
    )
    const tx = {
      userImport: {
        findUnique: jest.fn().mockResolvedValue(pendingImport),
        update: updateImport,
        findUniqueOrThrow: jest.fn().mockResolvedValue(approvedImport),
      },
      user: {
        create: createUser,
        findMany: jest.fn().mockResolvedValue([]),
      },
      userImportRow: { update: jest.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as unknown as PrismaService
    const recordUserCreated = jest.fn().mockResolvedValue(undefined)
    const audit = {
      recordUserCreated,
    } as unknown as UserAdministrationAuditService
    const repository = new UserImportRepository(prisma, audit)

    await repository.approveImport('import-1', 'admin-1')

    expect(createUser).toHaveBeenCalledTimes(1)
    const createUserInput = createUser.mock.calls[0][0]
    expect(createUserInput.data.email).toBe('student@example.com')
    expect(createUserInput.data.status).toBe('ACTIVE')
    expect(createUserInput.data.passwordHash).toBe('secured-hash')
    expect(tx.userImportRow.update).toHaveBeenCalledWith({
      where: { id: 'row-1' },
      data: { status: 'APPROVED', createdUserId: 'user-1' },
    })
    expect(recordUserCreated).toHaveBeenCalledTimes(1)
    expect(updateImport).toHaveBeenCalledTimes(1)
    const updateImportInput = updateImport.mock.calls[0][0]
    expect(updateImportInput.where).toEqual({ id: 'import-1' })
    expect(updateImportInput.data.status).toBe('APPROVED')
    expect(updateImportInput.data.approvedAt).toBeInstanceOf(Date)
  })

  it('cancels one pending row without deleting it or changing other rows', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 })
    const storedImport = {
      id: 'import-1',
      rows: [{ id: 'row-1' }, { id: 'row-2' }],
    }
    const prisma = {
      userImportRow: { updateMany },
      userImport: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(storedImport),
      },
    } as unknown as PrismaService
    const repository = new UserImportRepository(
      prisma,
      {} as UserAdministrationAuditService,
    )

    await expect(repository.cancelRow('import-1', 'row-1')).resolves.toBe(
      storedImport,
    )
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'row-1',
        importId: 'import-1',
        status: { in: ['VALID', 'INVALID'] },
        import: { status: 'PENDING' },
      },
      data: { status: 'CANCELLED' },
    })
  })
})
