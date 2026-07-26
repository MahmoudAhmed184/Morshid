import { z } from 'zod'

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Institutional email is required')
    .max(254, 'Email must be at most 254 characters')
    .pipe(z.email({ message: 'Enter a valid email address' }))
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
})

export type SignInFormValues = z.infer<typeof signInSchema>
