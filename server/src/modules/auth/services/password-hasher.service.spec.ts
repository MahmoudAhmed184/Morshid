import {
  createDeterministicArgon2idPasswordHash,
  PasswordHasherService,
} from './password-hasher.service'
import { createLegacyScryptPasswordHash } from '../../../../test/support/legacy-password-hash'

describe('PasswordHasherService', () => {
  it('hashes passwords with Argon2id and verifies matching passwords', () => {
    const service = new PasswordHasherService()
    const passwordHash = service.createHash('correct horse battery staple')

    expect(passwordHash).toMatch(
      /^argon2id:v1:m=19456,t=2,p=1,keylen=32:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/,
    )
    expect(
      service.verifyPassword('correct horse battery staple', passwordHash),
    ).toBe(true)
    expect(service.verifyPassword('wrong password', passwordHash)).toBe(false)
  })

  it('can create deterministic hashes when a salt is supplied', () => {
    const passwordHash = createDeterministicArgon2idPasswordHash(
      'password',
      'stable-test-salt',
    )

    expect(passwordHash).toBe(
      createDeterministicArgon2idPasswordHash('password', 'stable-test-salt'),
    )
  })

  it('verifies legacy scrypt hashes and marks them for rehash', () => {
    const service = new PasswordHasherService()
    const legacyPasswordHash = createLegacyScryptPasswordHash(
      'password',
      'stable-test-salt',
    )

    expect(service.verifyPassword('password', legacyPasswordHash)).toBe(true)
    expect(service.needsRehash(legacyPasswordHash)).toBe(true)
  })

  it('rejects malformed hashes', () => {
    const service = new PasswordHasherService()

    expect(service.verifyPassword('password', 'not-a-password-hash')).toBe(
      false,
    )
  })
})
