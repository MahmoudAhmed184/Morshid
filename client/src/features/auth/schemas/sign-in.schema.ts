import { z } from 'zod'

const emailFormatPattern = /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailDomainPattern = /^$|^[^@]*@[^@]*\.[^@.]+(?:@.*)?$/
const noWhitespacePattern = /^$|^\S+$/
const passwordBoundaryPattern = /^(?:$|\S(?:[\s\S]*\S)?)$/
const mockSignInPassword = 'password'

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Institutional email is required')
    .max(254, 'Email must be at most 254 characters')
    .regex(noWhitespacePattern, 'Email cannot contain spaces')
    .email({
      pattern: emailFormatPattern,
      message: 'Enter a valid email address',
    })
    .regex(emailDomainPattern, 'Email must include a valid domain')
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(1, 'Password is required')
    .regex(passwordBoundaryPattern, 'Password cannot start or end with spaces')
    .max(128, 'Password must be at most 128 characters')
    .min(8, 'Password must be at least 8 characters')
    .superRefine((value, context) => {
      if (value === mockSignInPassword) {
        return
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
