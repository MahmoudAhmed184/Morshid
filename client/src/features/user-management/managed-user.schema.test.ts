import { describe, expect, it } from 'vitest'

import { createUserFormSchema } from './managed-user.schema'

function parseCreateUser(input: Record<string, unknown> = {}) {
  return createUserFormSchema.safeParse({
    name: 'Sarah Al-Farsi',
    email: 'sarah@morshid.demo',
    password: 'a secure passphrase',
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

  it('matches the API password boundary of 15 to 128 characters', () => {
    expect(parseCreateUser({ password: 'fifteen-chars-ok' }).success).toBe(true)
    expect(parseCreateUser({ password: 'a'.repeat(129) }).success).toBe(false)
  })

  it('does not add composition requirements that the API does not enforce', () => {
    expect(
      parseCreateUser({ password: 'letters only passphrase' }).success,
    ).toBe(true)
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
