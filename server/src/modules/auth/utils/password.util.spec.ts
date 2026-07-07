import {
  BCRYPT_PASSWORD_COST,
  hashPassword,
  verifyPassword,
} from './password.util'

describe('password.util', () => {
  it('hashes and verifies a password with bcrypt', async () => {
    const hash = await hashPassword('correct horse battery staple')

    await expect(
      verifyPassword('correct horse battery staple', hash),
    ).resolves.toBe(true)
    expect(hash).toMatch(
      new RegExp(`^\\$2[abxy]\\$${BCRYPT_PASSWORD_COST.toString()}\\$`),
    )
  })

  it('uses a random salt for each new hash', async () => {
    const firstHash = await hashPassword('same password')
    const secondHash = await hashPassword('same password')

    expect(firstHash).not.toBe(secondHash)
    await expect(verifyPassword('same password', firstHash)).resolves.toBe(true)
    await expect(verifyPassword('same password', secondHash)).resolves.toBe(
      true,
    )
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('right password')

    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false)
  })

  it('fails closed for malformed stored hashes', async () => {
    await expect(verifyPassword('password', '')).resolves.toBe(false)
    await expect(verifyPassword('password', 'plaintext')).resolves.toBe(false)
    await expect(verifyPassword('password', '$2b$12$invalid')).resolves.toBe(
      false,
    )
  })
})
