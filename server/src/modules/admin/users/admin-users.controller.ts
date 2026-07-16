import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { getRequestContext } from '../../../common/http/request-context'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { UserRole } from '../../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../../auth/auth.guard'
import { Roles } from '../../auth/roles.decorator'
import {
  AdminCreateUserRequestDto,
  AdminCreateUserResponseDto,
  AdminDisableUserResponseDto,
  AdminReactivateUserResponseDto,
  AdminResetUserPasswordRequestDto,
  AdminResetUserPasswordResponseDto,
  AdminUserListResponseDto,
  adminListUsersQuerySchema,
  adminCreateUserRequestSchema,
  adminResetUserPasswordRequestSchema,
  type AdminCreateUserRequest,
  type AdminListUsersQuery,
  type AdminResetUserPasswordRequest,
} from './admin-users.dto'
import {
  invalidAdminCreateUserRequestException,
  invalidAdminListUsersRequestException,
  invalidAdminResetUserPasswordRequestException,
  type AdminUsersValidationIssue,
} from './admin-users.errors'
import { AdminUsersService } from './admin-users.service'

function mapZodIssue(issue: z.core.$ZodIssue): AdminUsersValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}

@Controller('admin/users')
@ApiTags('admin-users')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @SerializeOptions({ type: AdminUserListResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({
    type: AdminUserListResponseDto,
    description: 'A cursor-paginated list of users.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 50,
    },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  listUsers(
    @Query(
      new ZodValidationPipe(adminListUsersQuerySchema, (issues) =>
        invalidAdminListUsersRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: AdminListUsersQuery,
  ): Promise<AdminUserListResponseDto> {
    return this.adminUsersService.listUsers(query)
  }

  @Post()
  @SerializeOptions({
    type: AdminCreateUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create user' })
  @ApiBody({ type: AdminCreateUserRequestDto })
  @ApiCreatedResponse({
    type: AdminCreateUserResponseDto,
    description: 'The created student or instructor account.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  createUser(
    @Body(
      new ZodValidationPipe(adminCreateUserRequestSchema, (issues) =>
        invalidAdminCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: AdminCreateUserRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminCreateUserResponseDto> {
    return this.adminUsersService.createUser(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/disable')
  @SerializeOptions({
    type: AdminDisableUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Disable user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminDisableUserResponseDto,
    description: 'The disabled user account.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  disableUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminDisableUserResponseDto> {
    return this.adminUsersService.disableUser(
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/reactivate')
  @SerializeOptions({
    type: AdminReactivateUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Reactivate user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({
    type: AdminReactivateUserResponseDto,
    description: 'The reactivated user account.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  reactivateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminReactivateUserResponseDto> {
    return this.adminUsersService.reactivateUser(
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/reset-password')
  @SerializeOptions({
    type: AdminResetUserPasswordResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Reset user password' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: AdminResetUserPasswordRequestDto })
  @ApiOkResponse({
    type: AdminResetUserPasswordResponseDto,
    description: 'The user whose password was reset.',
  })
  @ApiBadRequestResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OpenApiValidationErrorDto) },
        { $ref: getSchemaPath(NestBadRequestErrorDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  resetUserPassword(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(
      new ZodValidationPipe(adminResetUserPasswordRequestSchema, (issues) =>
        invalidAdminResetUserPasswordRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: AdminResetUserPasswordRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminResetUserPasswordResponseDto> {
    return this.adminUsersService.resetUserPassword(
      userId,
      body,
      request.user,
      getRequestContext(request),
    )
  }
}
