import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  MOCK_LOGIN_DELAY_MS,
  loginApi,
} from './auth.api'

async function advanceMockLogin() {
  await vi.advanceTimersByTimeAsync(MOCK_LOGIN_DELAY_MS)
}

describe('loginApi', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['admin@morshid.demo', 'admin'],
    ['instructor@morshid.demo', 'instructor'],
    ['student1@morshid.demo', 'student'],
  ] as const)('authenticates seeded account %s', async (email, role) => {
    const request = loginApi(email, 'password')
    const assertion = expect(request).resolves.toMatchObject({
      accessToken: expect.stringContaining('mock-access-token:'),
      user: {
        email,
        role,
      },
    })

    await advanceMockLogin()

    await assertion
  })

  it('waits for the artificial login delay before resolving', async () => {
    const request = loginApi('admin@morshid.demo', 'password')
    let hasSettled = false
    void request.finally(() => {
      hasSettled = true
    })

    await vi.advanceTimersByTimeAsync(MOCK_LOGIN_DELAY_MS - 1)

    expect(hasSettled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(request).resolves.toBeDefined()
  })

  it('rejects wrong passwords with a generic error', async () => {
    const request = loginApi('admin@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await advanceMockLogin()

    await assertion
  })

  it('rejects unknown emails with a generic error', async () => {
    const request = loginApi('unknown@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await advanceMockLogin()

    await assertion
  })

  it('rejects disabled accounts with the disabled account error', async () => {
    const request = loginApi('disabled@morshid.demo', 'password')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'account_disabled',
      message: DISABLED_ACCOUNT_MESSAGE,
    })

    await advanceMockLogin()

    await assertion
  })

  it('does not reveal disabled accounts when the password is wrong', async () => {
    const request = loginApi('disabled@morshid.demo', 'notright')
    const assertion = expect(request).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: INVALID_CREDENTIALS_MESSAGE,
    })

    await advanceMockLogin()

    await assertion
  })
})
