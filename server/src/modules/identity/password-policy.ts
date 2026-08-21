import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 9
export const PASSWORD_MAX_LENGTH = 128

export const COMMON_PASSWORDS_BLOCKLIST = new Set([
  'password1234567',
  'password12345678',
  'password123456789',
  'passwordpassword',
  'correct horse battery staple',
  'correcthorsebatterystaple',
  '123456789012345',
  '1234567890123456',
  '0123456789012345',
  'qwertyuiopasdfg',
  'qwertyuiopasdfgh',
  'letmeinplease123',
  'adminadminadmin',
  'morshidpassword',
  'morshid12345678',
  'morshidsecretpass',
  'passphrase12345',
  'change_this_password',
  'changemeplease123',
  'administrator123',
  'supersecretpass1',
  'welcome12345678',
  'welcometomorshid',
])

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH.toString()} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH.toString()} characters`,
  )

export interface PasswordContext {
  currentPassword?: string
  email?: string
  displayName?: string
}

export interface PasswordValidationResult {
  isValid: boolean
  message?: string
}

export class PasswordPolicy {
  validate(
    newPassword: string,
    context?: PasswordContext,
  ): PasswordValidationResult {
    if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
      return {
        isValid: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH.toString()} characters`,
      }
    }

    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      return {
        isValid: false,
        message: `Password must be at most ${PASSWORD_MAX_LENGTH.toString()} characters`,
      }
    }

    if (
      context?.currentPassword !== undefined &&
      context.currentPassword.length > 0 &&
      newPassword === context.currentPassword
    ) {
      return {
        isValid: false,
        message: 'New password cannot be the same as the current password',
      }
    }

    const normalizedCandidate = newPassword.toLowerCase()

    if (COMMON_PASSWORDS_BLOCKLIST.has(normalizedCandidate)) {
      return {
        isValid: false,
        message:
          'Password is too common or easily guessed. Choose a more unique passphrase.',
      }
    }

    // Check repeated single character pattern (e.g., 'aaaaaaaaaaaaaaa')
    if (/^(.)\1+$/.test(newPassword)) {
      return {
        isValid: false,
        message:
          'Password is too common or easily guessed. Choose a more unique passphrase.',
      }
    }

    // Check context-specific tokens
    if (context?.email !== undefined && context.email.length > 0) {
      const emailLocalPart = context.email.split('@')[0].toLowerCase()
      if (
        emailLocalPart.length >= 3 &&
        normalizedCandidate.includes(emailLocalPart)
      ) {
        return {
          isValid: false,
          message:
            'Password cannot contain parts of your email address or personal details.',
        }
      }
    }

    if (context?.displayName !== undefined && context.displayName.length > 0) {
      const nameParts = context.displayName
        .toLowerCase()
        .split(/\s+/)
        .filter((part) => part.length >= 3)

      for (const part of nameParts) {
        if (normalizedCandidate.includes(part)) {
          return {
            isValid: false,
            message:
              'Password cannot contain parts of your display name or personal details.',
          }
        }
      }
    }

    if (
      normalizedCandidate === 'morshid' ||
      normalizedCandidate === 'morshidmorshid' ||
      normalizedCandidate === 'morshidmorshidmorshid'
    ) {
      return {
        isValid: false,
        message:
          'Password is too common or easily guessed. Choose a more unique passphrase.',
      }
    }

    return { isValid: true }
  }
}

export const defaultPasswordPolicy = new PasswordPolicy()
