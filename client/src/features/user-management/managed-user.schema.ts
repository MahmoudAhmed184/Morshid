import { z } from 'zod'

const userRoleSchema = z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
const userStatusSchema = z.enum(['ACTIVE', 'DISABLED'])

const userCourseAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  role: z.enum(['INSTRUCTOR', 'STUDENT']),
})

export const userRecordSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const managedUserSchema = userRecordSchema.extend({
  courseAssignments: z.object({
    courseCount: z.number().int().nonnegative(),
    instructorCourseCount: z.number().int().nonnegative(),
    studentCourseCount: z.number().int().nonnegative(),
    courses: z.array(userCourseAssignmentSchema),
  }),
})

export const managedUsersPageSchema = z.object({
  users: z.array(managedUserSchema),
  nextCursor: z.string().uuid().optional(),
})

export const managedUserResponseSchema = z.object({
  user: userRecordSchema,
})

export const bulkManagedUsersResponseSchema = z.object({
  users: z.array(userRecordSchema),
})

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(50, 'Password must be at most 50 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one symbol.')

export const createUserFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  password: passwordSchema,
  role: z.enum(['STUDENT', 'INSTRUCTOR']),
})

export const resetPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
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

export type ManagedUser = z.infer<typeof managedUserSchema>
export type UserRecord = z.infer<typeof userRecordSchema>
export type ManagedUserRole = z.infer<typeof userRoleSchema>
export type ManagedUserStatus = z.infer<typeof userStatusSchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>
export type CreateUserFormValues = z.infer<typeof createUserFormSchema>
