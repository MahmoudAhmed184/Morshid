import { UserRole, UserStatus } from '../identity.roles'
import {
  bulkCreateUsersRequestSchema,
  listUsersQuerySchema,
} from './user-administration.types'

describe('user administration request schemas', () => {
  it('accepts supported list filters', () => {
    expect(
      listUsersQuerySchema.parse({
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        courseId: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
        search: '  demo student  ',
      }),
    ).toEqual({
      limit: 50,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      courseId: '4c530c42-67bf-4cbe-a6f3-2c662564ddd1',
      search: 'demo student',
    })
  })

  it('rejects duplicate normalized emails in a bulk import', () => {
    const user = {
      displayName: 'Demo Student',
      email: 'student@morshid.demo',
      password: 'StrongPassword1!',
      role: UserRole.STUDENT,
    }

    const result = bulkCreateUsersRequestSchema.safeParse({
      users: [user, { ...user, email: ' STUDENT@MORSHID.DEMO ' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['users', 1, 'email'],
            message: 'Email appears more than once in this import',
          }),
        ]),
      )
    }
  })
})
