import { describe, expect, it } from 'vitest'

import { signInSchema } from './sign-in.schema'

const validPassword = 'password'

function parseSignIn(input: { email?: string; password?: string }) {
  return signInSchema.safeParse({
    email: input.email ?? 'instructor@morshid.demo',
    password: input.password ?? validPassword,
  })
}

function getFieldError(
  result: ReturnType<typeof parseSignIn>,
  field: 'email' | 'password',
) {
  if (result.success) {
    return undefined
  }

  return result.error.issues.find((issue) => issue.path[0] === field)?.message
}

describe('signInSchema email validation', () => {
  it('rejects an empty email with a required error', () => {
    const result = parseSignIn({ email: '' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'email')).toBe(
      'Institutional email is required',
    )
  })

  it('rejects an invalid email format', () => {
    const result = parseSignIn({ email: 'not-an-email' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'email')).toBe('Enter a valid email address')
  })

  it('rejects emails with spaces inside', () => {
    const result = parseSignIn({ email: 'user name@institution.edu' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'email')).toBe('Enter a valid email address')
  })

  it('rejects emails longer than 254 characters', () => {
    const result = parseSignIn({ email: `${'a'.repeat(243)}@institution.edu` })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'email')).toBe(
      'Email must be at most 254 characters',
    )
  })

  it('accepts valid email with leading and trailing spaces after trim', () => {
    const result = parseSignIn({ email: '  Instructor@Morshid.demo  ' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('instructor@morshid.demo')
    }
  })

  it('normalizes a valid email to lowercase', () => {
    const result = parseSignIn({ email: 'INSTRUCTOR@MORSHID.DEMO' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('instructor@morshid.demo')
    }
  })
})

describe('signInSchema password validation', () => {
  it('rejects an empty password with a required error', () => {
    const result = parseSignIn({ password: '' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe('Password is required')
  })

  it.each(['short', ' password ', 'lowercase', 'UPPERCASE', '123456'])(
    'accepts an existing account password without creation-policy checks: %s',
    (password) => {
      const result = parseSignIn({ password })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.password).toBe(password)
      }
    },
  )
})
