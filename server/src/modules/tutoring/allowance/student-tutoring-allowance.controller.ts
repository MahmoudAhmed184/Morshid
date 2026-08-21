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

export const tutoringAllowanceQuerySchema = z.object({
  courseId: z.uuid(),
})

export type TutoringAllowanceQueryDto = z.infer<
  typeof tutoringAllowanceQuerySchema
>

export interface TutoringAllowanceResponseDto {
  limit: number
  used: number
  remaining: number
  resetAt: string
  policyTimeZone: string
}

@Controller('tutoring/allowance')
@ApiTags('tutoring')
@Roles(UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN)
@ApiAccessTokenAuth()
export class StudentTutoringAllowanceController {
  constructor(private readonly allowancesResolver: AllowancesResolver) {}

  @Get()
  @ApiOperation({
    summary: 'Get current tutoring allowance and usage for a course',
  })
  @ApiOkResponse({
    description: 'The current tutoring allowance for the student and course.',
  })
  async getAllowance(
    @Query(
      new ZodValidationPipe(
        tutoringAllowanceQuerySchema,
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
    query: TutoringAllowanceQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<TutoringAllowanceResponseDto> {
    const state = await this.allowancesResolver.getTutoringAllowanceState({
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
