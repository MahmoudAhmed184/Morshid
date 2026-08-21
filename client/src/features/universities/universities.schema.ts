import { z } from 'zod'

export const universityStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
])

export const universitySortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'status',
  'studentsCount',
])

export const sortOrderSchema = z.enum(['asc', 'desc'])

export const universityOwnerSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  status: z.enum(['ACTIVE', 'DISABLED']),
})

export const universityItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  status: universityStatusSchema,
  owner: universityOwnerSummarySchema.nullable(),
  studentsCount: z.number().int().nonnegative(),
  instructorsCount: z.number().int().nonnegative(),
  coursesCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const paginationMetadataSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

export const universityListResponseSchema = z.object({
  data: z.array(universityItemSchema),
  pagination: paginationMetadataSchema,
})

export const universityResponseSchema = z.object({
  university: universityItemSchema,
})

export const createUniversityFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'University name is required')
    .max(160, 'University name must be at most 160 characters'),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Code may only contain letters, numbers, underscores, and hyphens',
    )
    .transform((code) => code.toUpperCase()),
  status: universityStatusSchema.default('ACTIVE'),
  ownerDisplayName: z
    .string()
    .trim()
    .min(1, 'Owner display name is required')
    .max(120, 'Owner display name must be at most 120 characters'),
  ownerEmail: z
    .string()
    .trim()
    .min(1, 'Owner email is required')
    .email('Invalid email address')
    .transform((email) => email.toLowerCase()),
  ownerPassword: z
    .string()
    .min(9, 'Password must be at least 9 characters')
    .max(128, 'Password must be at most 128 characters'),
})

export const createUniversityDetailsFormSchema =
  createUniversityFormSchema.pick({
    name: true,
    code: true,
    status: true,
  })

export const updateUniversityFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'University name is required')
      .max(160, 'University name must be at most 160 characters')
      .optional(),
    code: z
      .string()
      .trim()
      .min(2, 'Code must be at least 2 characters')
      .max(50, 'Code must be at most 50 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Code may only contain letters, numbers, underscores, and hyphens',
      )
      .transform((code) => code.toUpperCase())
      .optional(),
    ownerDisplayName: z
      .string()
      .trim()
      .min(1, 'Manager name is required')
      .max(120, 'Manager name must be at most 120 characters')
      .optional(),
    ownerEmail: z
      .string()
      .trim()
      .email('Invalid email address')
      .transform((email) => email.toLowerCase())
      .optional(),
    ownerPassword: z
      .string()
      .min(9, 'Password must be at least 9 characters')
      .max(128, 'Password must be at most 128 characters')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => data.name !== undefined || data.code !== undefined, {
    message: 'At least one field must be updated',
  })

export const updateUniversityStatusFormSchema = z.object({
  status: universityStatusSchema,
})

export type UniversityStatus = z.infer<typeof universityStatusSchema>
export type UniversitySortField = z.infer<typeof universitySortFieldSchema>
export type SortOrder = z.infer<typeof sortOrderSchema>
export type UniversityOwnerSummary = z.infer<
  typeof universityOwnerSummarySchema
>
export type UniversityItem = z.infer<typeof universityItemSchema>
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>
export type UniversityListResponse = z.infer<
  typeof universityListResponseSchema
>
export type UniversityResponse = z.infer<typeof universityResponseSchema>

export type CreateUniversityFormValues = z.input<
  typeof createUniversityFormSchema
>
export type UpdateUniversityFormValues = z.input<
  typeof updateUniversityFormSchema
>
export type UpdateUniversityStatusFormValues = z.input<
  typeof updateUniversityStatusFormSchema
>
