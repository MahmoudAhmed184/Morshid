import type { UserRole } from '../../../generated/prisma/client'

export interface AuthUserDto {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface AuthResponseDto {
  accessToken: string
  user: AuthUserDto
}
