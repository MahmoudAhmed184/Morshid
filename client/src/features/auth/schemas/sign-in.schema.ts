import { z } from 'zod'

const hasDomain = (email: string) => {
  const [, domain] = email.split('@')

  return Boolean(domain && domain.includes('.') && domain.split('.').pop())
}

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Institutional email is required')
    .superRefine((value, context) => {
      const trimmed = value.trim()

      if (!trimmed) {
        context.addIssue({
          code: 'custom',
          message: 'Institutional email is required',
        })
        return
      }

      if (trimmed.length > 254) {
        context.addIssue({
          code: 'custom',
          message: 'Email must be at most 254 characters',
        })
      }

      if (/\s/.test(trimmed)) {
        context.addIssue({
          code: 'custom',
          message: 'Email cannot contain spaces',
        })
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        context.addIssue({
          code: 'custom',
          message: 'Enter a valid email address',
        })
      }

      if (!hasDomain(trimmed)) {
        context.addIssue({
          code: 'custom',
          message: 'Email must include a valid domain',
        })
      }
    })
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'Security key is required')
    .superRefine((value, context) => {
      if (value !== value.trim()) {
        context.addIssue({
          code: 'custom',
          message: 'Password cannot start or end with spaces',
        })
      }

      if (value.length > 128) {
        context.addIssue({
          code: 'custom',
          message: 'Password must be at most 128 characters',
        })
      }

      if (value.length < 8) {
        context.addIssue({
          code: 'custom',
          message: 'Password must be at least 8 characters',
        })
      }

      if (!/[A-Z]/.test(value)) {
        context.addIssue({
          code: 'custom',
          message: 'Password must include an uppercase letter',
        })
      }

      if (!/[a-z]/.test(value)) {
        context.addIssue({
          code: 'custom',
          message: 'Password must include a lowercase letter',
        })
      }

      if (!/[0-9]/.test(value)) {
        context.addIssue({
          code: 'custom',
          message: 'Password must include a number',
        })
      }

      if (!/[^A-Za-z0-9]/.test(value)) {
        context.addIssue({
          code: 'custom',
          message: 'Password must include a special character',
        })
      }
    }),
  rememberMe: z.boolean(),
})

export type SignInFormValues = z.infer<typeof signInSchema>
