import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  SerializeOptions,
  UseInterceptors,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import type { z } from 'zod'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { UserRole } from '../../generated/prisma/client'
import { getRequestContext } from '../../common/http/request-context'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles } from '../identity/identity.roles'
import {
  AddCourseMemberRequestDto,
  CourseAdministrationDetailResponseDto,
  CourseAdministrationListResponseDto,
  CourseAdministrationMemberListResponseDto,
  CourseAdministrationMemberResponseDto,
  CreateCourseRequestDto,
  UpdateCourseRequestDto,
  UpdateMemberRoleRequestDto,
  addCourseMemberRequestSchema,
  createCourseRequestSchema,
  updateCourseRequestSchema,
  updateMemberRoleRequestSchema,
  type AddCourseMemberRequest,
  type CreateCourseRequest,
  type UpdateCourseRequest,
  type UpdateMemberRoleRequest,
} from './course-administration.types'
import {
  invalidCourseAdministrationRequestException,
  type CourseAdministrationValidationIssue,
} from './course-administration.errors'
import { CourseAdministrationService } from './course-administration.service'

class CourseAdministrationValidationPipe<T> implements PipeTransform<
  unknown,
  T
> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw invalidCourseAdministrationRequestException(
        result.error.issues.map(mapZodIssue),
      )
    }

    return result.data
  }
}

function mapZodIssue(
  issue: z.core.$ZodIssue,
): CourseAdministrationValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}

// Operations that validate both a request body and a UUID route parameter can
// answer with either the module validation envelope or Nest's ParseUUIDPipe
// error, so the contract documents both shapes.
const bodyOrRouteParamBadRequestSchema = {
  oneOf: [
    { $ref: getSchemaPath(OpenApiValidationErrorDto) },
    { $ref: getSchemaPath(NestBadRequestErrorDto) },
  ],
}

@Controller('admin/courses')
@ApiTags('courses')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class CourseAdministrationController {
  constructor(
    private readonly courseAdministrationService: CourseAdministrationService,
  ) {}

  @Get()
  @SerializeOptions({
    type: CourseAdministrationListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List courses for administration' })
  @ApiOkResponse({
    type: CourseAdministrationListResponseDto,
    description: 'All courses with administrative metadata.',
  })
  listCourses(): Promise<CourseAdministrationListResponseDto> {
    return this.courseAdministrationService.listCourses()
  }

  @Post()
  @SerializeOptions({
    type: CourseAdministrationDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create course' })
  @ApiBody({ type: CreateCourseRequestDto })
  @ApiCreatedResponse({
    type: CourseAdministrationDetailResponseDto,
    description: 'The created course.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  createCourse(
    @Body(new CourseAdministrationValidationPipe(createCourseRequestSchema))
    body: CreateCourseRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseAdministrationDetailResponseDto> {
    return this.courseAdministrationService.createCourse(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':courseId')
  @SerializeOptions({
    type: CourseAdministrationDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get course details' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: CourseAdministrationDetailResponseDto,
    description: 'Course details with memberships and material counts.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getCourse(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
  ): Promise<CourseAdministrationDetailResponseDto> {
    return this.courseAdministrationService.getCourse(courseId)
  }

  @Patch(':courseId')
  @SerializeOptions({
    type: CourseAdministrationDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update course' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiBody({ type: UpdateCourseRequestDto })
  @ApiOkResponse({
    type: CourseAdministrationDetailResponseDto,
    description: 'The updated course.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  updateCourse(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body(new CourseAdministrationValidationPipe(updateCourseRequestSchema))
    body: UpdateCourseRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseAdministrationDetailResponseDto> {
    return this.courseAdministrationService.updateCourse(
      courseId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Post(':courseId/members')
  @SerializeOptions({
    type: CourseAdministrationMemberResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Add course member' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiBody({ type: AddCourseMemberRequestDto })
  @ApiCreatedResponse({
    type: CourseAdministrationMemberResponseDto,
    description: 'The created course membership.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  addMember(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body(new CourseAdministrationValidationPipe(addCourseMemberRequestSchema))
    body: AddCourseMemberRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseAdministrationMemberResponseDto> {
    return this.courseAdministrationService.addMember(
      courseId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Delete(':courseId/members/:userId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove course member' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The membership was removed.' })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  async removeMember(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<void> {
    await this.courseAdministrationService.removeMember(
      courseId,
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':courseId/members')
  @SerializeOptions({
    type: CourseAdministrationMemberListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List course members' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: CourseAdministrationMemberListResponseDto,
    description: 'Memberships for the selected course.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  listMembers(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
  ): Promise<CourseAdministrationMemberListResponseDto> {
    return this.courseAdministrationService.listMembers(courseId)
  }

  @Patch(':courseId/members/:userId')
  @SerializeOptions({
    type: CourseAdministrationMemberResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update course member role' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: UpdateMemberRoleRequestDto })
  @ApiOkResponse({
    type: CourseAdministrationMemberResponseDto,
    description: 'The updated course membership.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  updateMemberRole(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(new CourseAdministrationValidationPipe(updateMemberRoleRequestSchema))
    body: UpdateMemberRoleRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseAdministrationMemberResponseDto> {
    return this.courseAdministrationService.updateMemberRole(
      courseId,
      userId,
      body,
      request.user,
      getRequestContext(request),
    )
  }
}
