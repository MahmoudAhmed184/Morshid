import {
  PasswordPolicy,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from './password-policy'

describe('PasswordPolicy', () => {
  const policy = new PasswordPolicy()

  it('accepts a valid passphrase with 9 or more characters including spaces and unicode', () => {
    const result = policy.validate(
      'this is a very strong passphrase with spaces',
    )
    expect(result.isValid).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('accepts valid unicode passphrases', () => {
    const result = policy.validate('كلمة_مرور_قوية_جدا_١٢٣٤٥')
    expect(result.isValid).toBe(true)
  })

  it('rejects passwords shorter than 9 characters', () => {
    const result = policy.validate('short123')
    expect(result.isValid).toBe(false)
    expect(result.message).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH.toString()} characters`,
    )
  })

  it('rejects passwords longer than 128 characters', () => {
    const longPass = 'a'.repeat(PASSWORD_MAX_LENGTH + 1)
    const result = policy.validate(longPass)
    expect(result.isValid).toBe(false)
    expect(result.message).toBe(
      `Password must be at most ${PASSWORD_MAX_LENGTH.toString()} characters`,
    )
  })

  it('rejects candidate passwords identical to current password', () => {
    const result = policy.validate('my current valid password 1234', {
      currentPassword: 'my current valid password 1234',
    })
    expect(result.isValid).toBe(false)
    expect(result.message).toBe(
      'New password cannot be the same as the current password',
    )
  })

  it('rejects common/compromised passphrases in blocklist', () => {
    const result = policy.validate('correct horse battery staple')
    expect(result.isValid).toBe(false)
    expect(result.message).toContain('too common or easily guessed')
  })

  it('rejects repeated single characters', () => {
    const result = policy.validate('aaaaaaaaaaaaaaaa')
    expect(result.isValid).toBe(false)
    expect(result.message).toContain('too common or easily guessed')
  })

  it('rejects passwords containing email local-part', () => {
    const result = policy.validate('student1_super_secure_password', {
      email: 'student1@morshid.demo',
    })
    expect(result.isValid).toBe(false)
    expect(result.message).toContain('email address')
  })

  it('rejects passwords containing display name parts', () => {
    const result = policy.validate('mahmoud_special_secure_phrase', {
      displayName: 'Mahmoud Ahmed',
    })
    expect(result.isValid).toBe(false)
    expect(result.message).toContain('display name')
  })

  it('does not require character class composition', () => {
    // lowercase letters only, but long enough and not in blocklist
    const result = policy.validate('valid lowercase passphrase only')
    expect(result.isValid).toBe(true)
  })
})
