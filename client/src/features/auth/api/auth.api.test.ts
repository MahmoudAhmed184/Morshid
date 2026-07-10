import { describe, expect, it } from 'vitest'

import {
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  loginApi,
} from './auth.api'

describe('loginApi', () => {
  it.each([
    ['admin@morshid.demo', 'admin'],
    ['instructor@morshid.demo', 'instructor'],
    ['student1@morshid.demo', 'student'],
  ] as const)('authenticates seeded account %s', async (email, role) => {
    const request = loginApi(email, 'password')
    const assertion = expect(request).resolves.toMatchObject({
      accessToken: expect.stringContaining('mock-access-token:'),
      refreshToken: expect.stringContaining('mock-refresh-token:'),
      user: {
        email,
        role,
      },
    })

    await assertion
  })

  it('rejects wrong passwords with a generic error', async () => {
    const request = loginApi('admin@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('rejects unknown emails with a generic error', async () => {
    const request = loginApi('unknown@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('rejects disabled accounts with the disabled account error', async () => {
    const request = loginApi('disabled@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'account_disabled',
      message: DISABLED_ACCOUNT_MESSAGE,
    })

    await assertion
  })

  it('does not reveal disabled accounts when the password is wrong', async () => {
    const request = loginApi('disabled@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })
})
