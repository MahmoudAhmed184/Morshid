import { hashPassword, verifyPassword } from './password.util'

describe('password.util', () => {
  it('hashes passwords with Argon2id and verifies matching passwords', () => {
    const passwordHash = hashPassword('correct horse battery staple')

    expect(passwordHash).toMatch(
      /^argon2id:v1:m=19456,t=2,p=1,keylen=32:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
    )
    expect(verifyPassword('correct horse battery staple', passwordHash)).toBe(
      true,
    )
    expect(verifyPassword('wrong password', passwordHash)).toBe(false)
  })

  it('can create deterministic hashes when a salt is supplied', () => {
    const passwordHash = hashPassword('password', {
      salt: 'stable-test-salt',
    })

    expect(passwordHash).toBe(
      hashPassword('password', {
        salt: 'stable-test-salt',
      }),
    )
  })

  it('rejects malformed hashes', () => {
    expect(verifyPassword('password', 'not-a-password-hash')).toBe(false)
  })
})
