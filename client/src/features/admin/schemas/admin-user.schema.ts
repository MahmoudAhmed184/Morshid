import { z } from 'zod'

const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
const maxImageSizeBytes = 2 * 1024 * 1024
const passwordPolicyMessage =
  'Password must be at least 9 characters and include uppercase, lowercase, number, and special character.'

function passwordMeetsPolicy(password: string) {
  return (
    password.length >= 9 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

const optionalImageSchema = z
  .custom<File | null>(
    (value) =>
      value === null || (typeof File !== 'undefined' && value instanceof File),
    'Choose a valid image file.',
  )
  .superRefine((file, context) => {
    if (!file) {
      return
    }

    if (
      !acceptedImageTypes.includes(
        file.type as (typeof acceptedImageTypes)[number],
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Image must be JPG, PNG, or WebP.',
      })
    }

    if (file.size > maxImageSizeBytes) {
      context.addIssue({
        code: 'custom',
        message: 'Image must be 2MB or smaller.',
      })
    }
  })

export const adminUserRoleSchema = z.enum(['Student', 'Instructor'])

export const adminUserFormBaseSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
  password: z.string(),
  role: adminUserRoleSchema,
  image: optionalImageSchema,
})

export type AdminUserFormValues = z.infer<typeof adminUserFormBaseSchema>

export function createAdminUserFormSchema(mode: 'create' | 'update') {
  return adminUserFormBaseSchema.superRefine((values, context) => {
    const password = values.password.trim()

    if (mode === 'create' && password.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password is required when creating a user.',
      })
      return
    }

    if (password.length > 0 && !passwordMeetsPolicy(password)) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: passwordPolicyMessage,
      })
    }
  })
}
