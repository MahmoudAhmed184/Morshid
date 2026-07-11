import { describe, expect, it } from 'vitest'

import {
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  loginApi,
} from './auth.api'

describe('loginApi', () => {
  it.each([
    ['admin@morshid.demo', 'ADMIN'],
    ['instructor@morshid.demo', 'INSTRUCTOR'],
    ['student1@morshid.demo', 'STUDENT'],
  ] as const)('authenticates seeded account %s', async (email, role) => {
    const request = loginApi(email, 'password')
    const assertion = expect(request).resolves.toMatchObject({
      tokenType: 'Bearer',
      accessToken: expect.stringContaining('mock-access-token:'),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.stringContaining('mock-refresh-token:'),
      refreshTokenExpiresAt: expect.any(String),
      user: {
        email,
        role,
        status: 'ACTIVE',
        courses: [],
      },
    })

    await assertion
  })

  it('rejects wrong passwords with a generic error', async () => {
    const request = loginApi('admin@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('rejects unknown emails with a generic error', async () => {
    const request = loginApi('unknown@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })

  it('rejects disabled accounts with the disabled account error', async () => {
    const request = loginApi('disabled@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
      message: DISABLED_ACCOUNT_MESSAGE,
    })

    await assertion
  })

  it('does not reveal disabled accounts when the password is wrong', async () => {
    const request = loginApi('disabled@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await assertion
  })
})
