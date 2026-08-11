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
} from '../../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { UserRole } from '../../../generated/prisma/client'
import { getRequestContext } from '../../../common/http/request-context'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles } from '../../identity/identity.roles'
import {
  AdminAddCourseMemberRequestDto,
  AdminCourseDetailResponseDto,
  AdminCourseListResponseDto,
  AdminCourseMemberListResponseDto,
  AdminCourseMemberResponseDto,
  AdminCreateCourseRequestDto,
  AdminMaterialListResponseDto,
  AdminMaterialResponseDto,
  AdminUpdateCourseRequestDto,
  AdminUpdateMaterialRequestDto,
  AdminUpdateMemberRoleRequestDto,
  adminAddCourseMemberRequestSchema,
  adminCreateCourseRequestSchema,
  adminUpdateCourseRequestSchema,
  adminUpdateMaterialRequestSchema,
  adminUpdateMemberRoleRequestSchema,
  type AdminAddCourseMemberRequest,
  type AdminCreateCourseRequest,
  type AdminUpdateCourseRequest,
  type AdminUpdateMaterialRequest,
  type AdminUpdateMemberRoleRequest,
} from './admin-courses.dto'
import {
  invalidAdminCoursesRequestException,
  type AdminCoursesValidationIssue,
} from './admin-courses.errors'
import { AdminCoursesService } from './admin-courses.service'

class AdminCoursesValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw invalidAdminCoursesRequestException(
        result.error.issues.map(mapZodIssue),
      )
    }

    return result.data
  }
}

function mapZodIssue(issue: z.core.$ZodIssue): AdminCoursesValidationIssue {
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
@ApiTags('admin-courses')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminCoursesController {
  constructor(private readonly adminCoursesService: AdminCoursesService) {}

  @Get()
  @SerializeOptions({
    type: AdminCourseListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List courses for administration' })
  @ApiOkResponse({
    type: AdminCourseListResponseDto,
    description: 'All courses with administrative metadata.',
  })
  listCourses(): Promise<AdminCourseListResponseDto> {
    return this.adminCoursesService.listCourses()
  }

  @Post()
  @SerializeOptions({
    type: AdminCourseDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create course' })
  @ApiBody({ type: AdminCreateCourseRequestDto })
  @ApiCreatedResponse({
    type: AdminCourseDetailResponseDto,
    description: 'The created course.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  createCourse(
    @Body(new AdminCoursesValidationPipe(adminCreateCourseRequestSchema))
    body: AdminCreateCourseRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminCourseDetailResponseDto> {
    return this.adminCoursesService.createCourse(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':courseId')
  @SerializeOptions({
    type: AdminCourseDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get course details' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminCourseDetailResponseDto,
    description: 'Course details with memberships and material counts.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getCourse(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
  ): Promise<AdminCourseDetailResponseDto> {
    return this.adminCoursesService.getCourse(courseId)
  }

  @Patch(':courseId')
  @SerializeOptions({
    type: AdminCourseDetailResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update course' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiBody({ type: AdminUpdateCourseRequestDto })
  @ApiOkResponse({
    type: AdminCourseDetailResponseDto,
    description: 'The updated course.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  updateCourse(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body(new AdminCoursesValidationPipe(adminUpdateCourseRequestSchema))
    body: AdminUpdateCourseRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminCourseDetailResponseDto> {
    return this.adminCoursesService.updateCourse(
      courseId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Post(':courseId/members')
  @SerializeOptions({
    type: AdminCourseMemberResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Add course member' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiBody({ type: AdminAddCourseMemberRequestDto })
  @ApiCreatedResponse({
    type: AdminCourseMemberResponseDto,
    description: 'The created course membership.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  addMember(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body(new AdminCoursesValidationPipe(adminAddCourseMemberRequestSchema))
    body: AdminAddCourseMemberRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminCourseMemberResponseDto> {
    return this.adminCoursesService.addMember(
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
    await this.adminCoursesService.removeMember(
      courseId,
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':courseId/members')
  @SerializeOptions({
    type: AdminCourseMemberListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List course members' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminCourseMemberListResponseDto,
    description: 'Memberships for the selected course.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  listMembers(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
  ): Promise<AdminCourseMemberListResponseDto> {
    return this.adminCoursesService.listMembers(courseId)
  }

  @Patch(':courseId/members/:userId')
  @SerializeOptions({
    type: AdminCourseMemberResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update course member role' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: AdminUpdateMemberRoleRequestDto })
  @ApiOkResponse({
    type: AdminCourseMemberResponseDto,
    description: 'The updated course membership.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  updateMemberRole(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(new AdminCoursesValidationPipe(adminUpdateMemberRoleRequestSchema))
    body: AdminUpdateMemberRoleRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminCourseMemberResponseDto> {
    return this.adminCoursesService.updateMemberRole(
      courseId,
      userId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':courseId/materials')
  @SerializeOptions({
    type: AdminMaterialListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List course materials' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminMaterialListResponseDto,
    description: 'Materials for the selected course.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  listMaterials(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
  ): Promise<AdminMaterialListResponseDto> {
    return this.adminCoursesService.listMaterials(courseId)
  }

  @Get(':courseId/materials/:materialId')
  @SerializeOptions({
    type: AdminMaterialResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get course material' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminMaterialResponseDto,
    description: 'The selected course material.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
  ): Promise<AdminMaterialResponseDto> {
    return this.adminCoursesService.getMaterial(courseId, materialId)
  }

  @Patch(':courseId/materials/:materialId')
  @SerializeOptions({
    type: AdminMaterialResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update course material' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiBody({ type: AdminUpdateMaterialRequestDto })
  @ApiOkResponse({
    type: AdminMaterialResponseDto,
    description: 'The updated course material.',
  })
  @ApiBadRequestResponse({ schema: bodyOrRouteParamBadRequestSchema })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  updateMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Body(new AdminCoursesValidationPipe(adminUpdateMaterialRequestSchema))
    body: AdminUpdateMaterialRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminMaterialResponseDto> {
    return this.adminCoursesService.updateMaterial(
      courseId,
      materialId,
      body,
      request.user,
      getRequestContext(request),
    )
  }
}
