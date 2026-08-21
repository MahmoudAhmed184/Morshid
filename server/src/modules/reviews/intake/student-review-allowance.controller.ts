import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'

import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import { AllowancesResolver } from '../../allowances/interface/allowances-resolver'

export const reviewAllowanceQuerySchema = z.object({
  courseId: z.uuid(),
})

export type ReviewAllowanceQueryDto = z.infer<typeof reviewAllowanceQuerySchema>

export interface ReviewAllowanceResponseDto {
  limit: number
  used: number
  remaining: number
  resetAt: string
  policyTimeZone: string
}

@Controller('reviews/allowance')
@ApiTags('student-reviews')
@Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
@ApiAccessTokenAuth()
export class StudentReviewAllowanceController {
  constructor(private readonly allowancesResolver: AllowancesResolver) {}

  @Get()
  @ApiOperation({
    summary: 'Get current review allowance and usage for a course',
  })
  @ApiOkResponse({
    description: 'The current review allowance for the student and course.',
  })
  async getAllowance(
    @Query(
      new ZodValidationPipe(
        reviewAllowanceQuerySchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid courseId parameter',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'query',
              message: issue.message,
            })),
          }),
      ),
    )
    query: ReviewAllowanceQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ReviewAllowanceResponseDto> {
    const state = await this.allowancesResolver.getReviewAllowanceState({
      studentId: request.user.id,
      courseId: query.courseId,
    })

    return {
      limit: state.limit,
      used: state.used,
      remaining: state.remaining,
      resetAt: state.resetAt.toISOString(),
      policyTimeZone: state.policyTimeZone,
    }
  }
}
