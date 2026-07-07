import { compare, hash } from 'bcrypt'

export const BCRYPT_PASSWORD_COST = 12

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, BCRYPT_PASSWORD_COST)
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string,
): Promise<boolean> {
  if (!isBcryptHash(storedHash)) {
    return false
  }

  try {
    return await compare(plaintext, storedHash)
  } catch {
    return false
  }
}

function isBcryptHash(storedHash: string): boolean {
  return /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedHash)
}
