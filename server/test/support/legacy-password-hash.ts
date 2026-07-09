import { scryptSync } from 'node:crypto'

export function createLegacyScryptPasswordHash(
  password: string,
  passwordSalt: string,
) {
  const derivedKey = scryptSync(password, passwordSalt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
  })

  return [
    'scrypt',
    'v1',
    'N=16384,r=8,p=1,keylen=64',
    Buffer.from(passwordSalt).toString('base64url'),
    derivedKey.toString('base64url'),
  ].join(':')
}
