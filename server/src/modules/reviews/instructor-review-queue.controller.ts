import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { OpenApiErrorDto } from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import { invalidReviewRequestException } from './review-case.errors'
import {
  InstructorReviewQueueResponseDto,
  instructorReviewQueueQuerySchema,
  type InstructorReviewQueueQuery,
} from './instructor-review-queue.dto'
import { InstructorReviewQueueService } from './instructor-review-queue.service'

@Controller('instructor/reviews')
@ApiTags('instructor-reviews')
@Roles(UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class InstructorReviewQueueController {
  constructor(private readonly service: InstructorReviewQueueService) {}

  @Get()
  @SerializeOptions({
    type: InstructorReviewQueueResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List the Instructor review queue' })
  @ApiOkResponse({
    type: InstructorReviewQueueResponseDto,
    description:
      'Pending-first queue for courses owned by the authenticated Instructor.',
  })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description:
      'The requested course is absent or not owned by the Instructor.',
  })
  @ApiQuery({ name: 'courseId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  list(
    @Query(
      new ZodValidationPipe(instructorReviewQueueQuerySchema, (issues) =>
        invalidReviewRequestException(
          issues.map((issue) => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          })),
        ),
      ),
    )
    query: InstructorReviewQueueQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<InstructorReviewQueueResponseDto> {
    return this.service.list(request.user, query)
  }
}
