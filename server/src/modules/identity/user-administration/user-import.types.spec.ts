import { updateUserImportRowSchema } from './user-import.types'

describe('user import row update schema', () => {
  it('treats an empty password as omitted', () => {
    expect(updateUserImportRowSchema.parse({ password: '' })).toEqual({
      password: undefined,
    })
  })

  it('accepts a valid replacement password', () => {
    expect(
      updateUserImportRowSchema.parse({
        password: 'a replacement passphrase',
      }),
    ).toEqual({ password: 'a replacement passphrase' })
  })

  it('returns the password policy message for a short replacement password', () => {
    const result = updateUserImportRowSchema.safeParse({ password: 'short' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['password'],
          message: 'Password must be at least 15 characters',
        }),
      )
    }
  })
})
