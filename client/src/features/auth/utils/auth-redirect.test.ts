import { describe, expect, it } from 'vitest'

import { getAuthRedirectPath } from './auth-redirect'

describe('getAuthRedirectPath', () => {
  it.each([
    ['admin', '/admin'],
    ['instructor', '/instructor'],
    ['student', '/student'],
  ] as const)('redirects %s users to %s', (role, path) => {
    expect(getAuthRedirectPath(role)).toBe(path)
  })
})
