import { describe, expect, it } from 'vitest'

import { createAdminUserFormSchema } from './admin-user.schema'

const validPassword = 'Password1!'
const passwordPolicyMessage =
  'Password must be at least 9 characters and include uppercase, lowercase, number, and special character.'

function parseAdminUserForm(
  mode: 'create' | 'update',
  input: Partial<{
    name: string
    email: string
    password: string
    role: string
    image: File | null
  }> = {},
) {
  return createAdminUserFormSchema(mode).safeParse({
    name: input.name ?? 'Sarah Al-Farsi',
    email: input.email ?? 'sarah@morshid.demo',
    password: input.password ?? validPassword,
    role: input.role ?? 'Student',
    image: input.image ?? null,
  })
}

function getFieldError(
  result: ReturnType<typeof parseAdminUserForm>,
  field: 'name' | 'email' | 'password' | 'role' | 'image',
) {
  if (result.success) {
    return undefined
  }

  return result.error.issues.find((issue) => issue.path[0] === field)?.message
}

describe('admin user form schema', () => {
  it('accepts a valid student user', () => {
    const result = parseAdminUserForm('create')

    expect(result.success).toBe(true)
  })

  it('accepts a valid instructor user', () => {
    const result = parseAdminUserForm('create', { role: 'Instructor' })

    expect(result.success).toBe(true)
  })

  it('rejects admin role from this form', () => {
    const result = parseAdminUserForm('create', { role: 'Admin' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'role')).toBeDefined()
  })

  it('requires password when creating a user', () => {
    const result = parseAdminUserForm('create', { password: '' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(
      'Password is required when creating a user.',
    )
  })

  it('allows an empty password when updating a user', () => {
    const result = parseAdminUserForm('update', { password: '' })

    expect(result.success).toBe(true)
  })

  it('requires policy-compliant password when updating with a new password', () => {
    const result = parseAdminUserForm('update', { password: 'short' })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(passwordPolicyMessage)
  })

  it.each([
    ['missing uppercase', 'password1!'],
    ['missing lowercase', 'PASSWORD1!'],
    ['missing number', 'Password!'],
    ['missing special character', 'Password1'],
    ['too short', 'Pass1!'],
  ])('rejects password with %s', (_case, password) => {
    const result = parseAdminUserForm('create', { password })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'password')).toBe(passwordPolicyMessage)
  })

  it('accepts a supported optional image', () => {
    const image = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    const result = parseAdminUserForm('create', { image })

    expect(result.success).toBe(true)
  })

  it('rejects unsupported image types', () => {
    const image = new File(['avatar'], 'avatar.gif', { type: 'image/gif' })
    const result = parseAdminUserForm('create', { image })

    expect(result.success).toBe(false)
    expect(getFieldError(result, 'image')).toBe(
      'Image must be JPG, PNG, or WebP.',
    )
  })
})
