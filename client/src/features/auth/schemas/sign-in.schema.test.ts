import { describe, expect, it } from 'vitest'

import { signInSchema } from './sign-in.schema'

const validPassword = 'Password1!'

function parseSignIn(input: {
  email?: string
  password?: string
  rememberMe?: boolean
}) {
  return signInSchema.safeParse({
    email: input.email ?? 'instructor@institution.edu',
    password: input.password ?? validPassword,
    rememberMe: input.rememberMe ?? true,
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
    expect(getFieldError(result, 'email')).toBe('Email cannot contain spaces')
  })

  it('rejects emails longer than 254 characters', () => {
    const result = parseSignIn({ email: `${'a'.repeat(243)}@institution.edu` })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'email')).toBe(
      'Email must be at most 254 characters',
    )
  })

  it('accepts valid email with leading and trailing spaces after trim', () => {
    const result = parseSignIn({ email: '  Instructor@Institution.edu  ' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('instructor@institution.edu')
    }
  })

  it('normalizes a valid email to lowercase', () => {
    const result = parseSignIn({ email: 'INSTRUCTOR@INSTITUTION.EDU' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('instructor@institution.edu')
    }
  })
})

describe('signInSchema password validation', () => {
  it('rejects an empty password with a required error', () => {
    const result = parseSignIn({ password: '' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe('Security key is required')
  })

  it('rejects passwords shorter than 8 characters', () => {
    const result = parseSignIn({ password: 'Pass1!' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must be at least 8 characters',
    )
  })

  it('rejects passwords longer than 128 characters', () => {
    const result = parseSignIn({ password: `Aa1!${'x'.repeat(125)}` })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must be at most 128 characters',
    )
  })

  it('rejects passwords with leading or trailing spaces', () => {
    const result = parseSignIn({ password: ' Password1! ' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password cannot start or end with spaces',
    )
  })

  it('rejects passwords without an uppercase letter', () => {
    const result = parseSignIn({ password: 'password1!' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must include an uppercase letter',
    )
  })

  it('rejects passwords without a lowercase letter', () => {
    const result = parseSignIn({ password: 'PASSWORD1!' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must include a lowercase letter',
    )
  })

  it('rejects passwords without a number', () => {
    const result = parseSignIn({ password: 'Password!!' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must include a number',
    )
  })

  it('rejects passwords without a special character', () => {
    const result = parseSignIn({ password: 'Password12' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password must include a special character',
    )
  })

  it('accepts a valid password', () => {
    const result = parseSignIn({ password: validPassword })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.password).toBe(validPassword)
    }
  })
})
