import { z } from 'zod'

const adminUserRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
const adminUserStatusSchema = z.enum(['ACTIVE', 'DISABLED'])

const adminUserCourseAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  role: z.enum(['INSTRUCTOR', 'STUDENT']),
})

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: adminUserRoleSchema,
  status: adminUserStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const adminManagedUserSchema = adminUserSchema.extend({
  courseAssignments: z.object({
    courseCount: z.number().int().nonnegative(),
    instructorCourseCount: z.number().int().nonnegative(),
    studentCourseCount: z.number().int().nonnegative(),
    courses: z.array(adminUserCourseAssignmentSchema),
  }),
})

export const adminManagedUsersPageSchema = z.object({
  users: z.array(adminManagedUserSchema),
  nextCursor: z.string().uuid().optional(),
})

export const adminManagedUserResponseSchema = z.object({
  user: adminUserSchema,
})

export const adminPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(50, 'Password must be at most 50 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one symbol.')

export const adminCreateUserFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  password: adminPasswordSchema,
  role: z.enum(['STUDENT', 'INSTRUCTOR']),
})

export const adminResetPasswordFormSchema = z
  .object({
    newPassword: adminPasswordSchema,
    confirmPassword: z.string(),
  })
  .superRefine(({ newPassword, confirmPassword }, context) => {
    if (newPassword !== confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      })
    }
  })

export type AdminManagedUser = z.infer<typeof adminManagedUserSchema>
export type AdminUser = z.infer<typeof adminUserSchema>
export type AdminManagedUserRole = z.infer<typeof adminUserRoleSchema>
export type AdminManagedUserStatus = z.infer<typeof adminUserStatusSchema>
export type AdminResetPasswordFormValues = z.infer<
  typeof adminResetPasswordFormSchema
>
export type AdminCreateUserFormValues = z.infer<
  typeof adminCreateUserFormSchema
>
