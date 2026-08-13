import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
} from '../../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import { StudentReviewDetailDto } from './student-review-detail.dto'
import { StudentReviewDetailService } from './student-review-detail.service'

@Controller('student/reviews')
@ApiTags('student-reviews')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class StudentReviewDetailController {
  constructor(private readonly service: StudentReviewDetailService) {}

  @Get(':reviewCaseId')
  @SerializeOptions({ type: StudentReviewDetailDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Get a Student-safe review outcome' })
  @ApiParam({ name: 'reviewCaseId', format: 'uuid' })
  @ApiOkResponse({ type: StudentReviewDetailDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description: 'The review is absent or inaccessible to the Student.',
  })
  get(
    @Param('reviewCaseId', new ParseUUIDPipe({ version: '4' }))
    reviewCaseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentReviewDetailDto> {
    return this.service.get(request.user, reviewCaseId)
  }
}
