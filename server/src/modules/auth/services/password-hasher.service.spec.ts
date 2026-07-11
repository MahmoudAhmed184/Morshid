import {
  createDeterministicArgon2idPasswordHash,
  PasswordHasherService,
} from './password-hasher.service'

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

  it('rejects malformed hashes', () => {
    const service = new PasswordHasherService()

    expect(service.verifyPassword('password', 'not-a-password-hash')).toBe(
      false,
    )
  })

  it('rejects unsupported hash algorithms', () => {
    const service = new PasswordHasherService()
    const unsupportedHash =
      'unsupported:v1:m=19456,t=2,p=1,keylen=32:c3RhYmxlLXRlc3Qtc2FsdA:Lb-P2oPdhjuxvynG1OMDQBSGkxiQwjaG7GkL9nb5hODh0EjiZ3jw7zbxrFmdw4MBXO9_r9KPmB6ysPQV8p-u6w'

    expect(service.verifyPassword('password', unsupportedHash)).toBe(false)
  })
})
