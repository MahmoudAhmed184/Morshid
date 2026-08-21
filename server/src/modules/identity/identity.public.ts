import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export { PasswordHasher } from './password-hasher'
export { passwordSchema, defaultPasswordPolicy } from './password-policy'
