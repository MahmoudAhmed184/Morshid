import { ApiProperty } from '@nestjs/swagger'
import { Expose } from 'class-transformer'
import { z } from 'zod'

import {
  ExplanationDetailLevel,
  normalizeExplanationDetailLevel,
} from './explanation-detail-level'

export class StudentTutoringPreferencesDto {
  @ApiProperty({
    enum: ['CONCISE', 'STANDARD', 'DETAILED'],
    description:
      'The resolved explanation detail preference level for the student',
    example: 'STANDARD',
  })
  @Expose()
  explanationDetailLevel!: ExplanationDetailLevel
}

export const updateStudentTutoringPreferencesSchema = z.object({
  explanationDetailLevel: z
    .enum(['CONCISE', 'STANDARD', 'DETAILED'])
    .transform(normalizeExplanationDetailLevel),
})

export type UpdateStudentTutoringPreferencesRequest = z.infer<
  typeof updateStudentTutoringPreferencesSchema
>

export class UpdateStudentTutoringPreferencesRequestDto {
  @ApiProperty({
    enum: ['CONCISE', 'STANDARD', 'DETAILED'],
    description: 'The desired explanation detail level',
    example: 'STANDARD',
  })
  explanationDetailLevel!: ExplanationDetailLevel
}
