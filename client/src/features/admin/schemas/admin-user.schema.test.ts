import { describe, expect, it } from 'vitest'

import { adminCreateUserFormSchema } from './admin-managed-user.schema'

function parseCreateUser(input: Record<string, unknown> = {}) {
  return adminCreateUserFormSchema.safeParse({
    name: 'Sarah Al-Farsi',
    email: 'sarah@morshid.demo',
    password: 'Password1!',
    role: 'STUDENT',
    ...input,
  })
}

describe('admin create-user form schema', () => {
  it.each(['STUDENT', 'INSTRUCTOR'])(
    'accepts the API-supported %s role',
    (role) => {
      expect(parseCreateUser({ role }).success).toBe(true)
    },
  )

  it('rejects the admin role', () => {
    expect(parseCreateUser({ role: 'ADMIN' }).success).toBe(false)
  })

  it('matches the API password boundary of 8 to 50 characters', () => {
    expect(parseCreateUser({ password: 'Pass123!' }).success).toBe(true)
    expect(
      parseCreateUser({ password: `Pass123!${'a'.repeat(43)}` }).success,
    ).toBe(false)
  })

  it.each([
    ['missing a letter', '1234567!'],
    ['missing a number', 'Password!'],
    ['missing a symbol', 'Password1'],
  ])('rejects a password %s', (_case, password) => {
    expect(parseCreateUser({ password }).success).toBe(false)
  })

  it('normalizes the email and display name for the API', () => {
    const result = parseCreateUser({
      name: '  Sarah Al-Farsi  ',
      email: '  SARAH@MORSHID.DEMO ',
    })

    expect(result.success && result.data).toMatchObject({
      name: 'Sarah Al-Farsi',
      email: 'sarah@morshid.demo',
    })
  })
})
