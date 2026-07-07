import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .max(50, 'Password must be at most 50 characters'),
})

export type LoginDto = z.infer<typeof loginSchema>
