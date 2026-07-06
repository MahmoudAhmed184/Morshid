export interface AuthResponseDto {
  accessToken: string
  user: {
    id: string
    email: string
    displayName: string
    role: string
  }
}
