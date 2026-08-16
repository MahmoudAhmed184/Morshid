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
  ApiForbiddenResponse,
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
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import { UserRole } from '../identity.roles'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles } from '../../identity/identity.roles'
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
  BulkCreateUsersRequestDto,
  BulkCreateUsersResponseDto,
  DisableUserResponseDto,
  ReactivateUserResponseDto,
  ResetUserPasswordRequestDto,
  ResetUserPasswordResponseDto,
  UpdateUserRequestDto,
  UpdateUserResponseDto,
  ManagedUserListResponseDto,
  listUsersQuerySchema,
  createUserRequestSchema,
  bulkCreateUsersRequestSchema,
  resetUserPasswordRequestSchema,
  updateUserRequestSchema,
  type CreateUserRequest,
  type BulkCreateUsersRequest,
  type ListUsersQuery,
  type ResetUserPasswordRequest,
  type UpdateUserRequest,
} from './user-administration.types'
import {
  invalidCreateUserRequestException,
  invalidListUsersRequestException,
  invalidResetUserPasswordRequestException,
  invalidUpdateUserRequestException,
  type UserAdministrationValidationIssue,
} from './user-administration.errors'
import { UserAdministrationService } from './user-administration.service'
import {
  CreateUserImportDto,
  UpdateUserImportRowDto,
  UserImportResponseDto,
  createUserImportSchema,
  updateUserImportRowSchema,
  userImportIdSchema,
  type CreateUserImport,
  type UpdateUserImportRow,
} from './user-import.types'
import { UserImportService } from './user-import.service'

function mapZodIssue(
  issue: z.core.$ZodIssue,
): UserAdministrationValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}

@Controller('admin/users')
@ApiTags('user-administration')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class UserAdministrationController {
  constructor(
    private readonly userAdministrationService: UserAdministrationService,
    private readonly userImportService: UserImportService,
  ) {}

  @Get()
  @SerializeOptions({
    type: ManagedUserListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({
    type: ManagedUserListResponseDto,
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
      new ZodValidationPipe(listUsersQuerySchema, (issues) =>
        invalidListUsersRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListUsersQuery,
  ): Promise<ManagedUserListResponseDto> {
    return this.userAdministrationService.listUsers(query)
  }

  @Post()
  @SerializeOptions({
    type: CreateUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create user' })
  @ApiBody({ type: CreateUserRequestDto })
  @ApiCreatedResponse({
    type: CreateUserResponseDto,
    description: 'The created student or instructor account.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  createUser(
    @Body(
      new ZodValidationPipe(createUserRequestSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: CreateUserRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CreateUserResponseDto> {
    return this.userAdministrationService.createUser(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Post('bulk')
  @SerializeOptions({
    type: BulkCreateUsersResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create users in one atomic import' })
  @ApiBody({ type: BulkCreateUsersRequestDto })
  @ApiCreatedResponse({
    type: BulkCreateUsersResponseDto,
    description: 'The imported student or instructor accounts.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  bulkCreateUsers(
    @Body(
      new ZodValidationPipe(bulkCreateUsersRequestSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: BulkCreateUsersRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<BulkCreateUsersResponseDto> {
    return this.userAdministrationService.bulkCreateUsers(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Post('imports')
  @SerializeOptions({ type: UserImportResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Stage CSV user rows for admin review' })
  @ApiBody({ type: CreateUserImportDto })
  @ApiCreatedResponse({ type: UserImportResponseDto })
  createUserImport(
    @Body(
      new ZodValidationPipe(createUserImportSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: CreateUserImport,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<UserImportResponseDto> {
    return this.userImportService.create(body, request.user)
  }

  @Get('imports/:importId')
  @SerializeOptions({ type: UserImportResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Get a staged user import' })
  @ApiOkResponse({ type: UserImportResponseDto })
  getUserImport(
    @Param(
      'importId',
      new ZodValidationPipe(userImportIdSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    importId: string,
  ): Promise<UserImportResponseDto> {
    return this.userImportService.get(importId)
  }

  @Patch('imports/:importId/rows/:rowId')
  @SerializeOptions({ type: UserImportResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Edit and revalidate a staged user import row' })
  @ApiBody({ type: UpdateUserImportRowDto })
  @ApiOkResponse({ type: UserImportResponseDto })
  updateUserImportRow(
    @Param('importId', ParseUUIDPipe) importId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body(
      new ZodValidationPipe(updateUserImportRowSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateUserImportRow,
  ): Promise<UserImportResponseDto> {
    return this.userImportService.updateRow(importId, rowId, body)
  }

  @Post('imports/:importId/rows/:rowId/cancel')
  @SerializeOptions({ type: UserImportResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Cancel a staged user import row' })
  @ApiOkResponse({ type: UserImportResponseDto })
  cancelUserImportRow(
    @Param('importId', ParseUUIDPipe) importId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
  ): Promise<UserImportResponseDto> {
    return this.userImportService.cancelRow(importId, rowId)
  }

  @Post('imports/:importId/approve')
  @SerializeOptions({ type: UserImportResponseDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Approve all valid rows in a staged user import' })
  @ApiOkResponse({ type: UserImportResponseDto })
  approveUserImport(
    @Param(
      'importId',
      new ZodValidationPipe(userImportIdSchema, (issues) =>
        invalidCreateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    importId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<UserImportResponseDto> {
    return this.userImportService.approve(
      importId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId')
  @SerializeOptions({
    type: UpdateUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: UpdateUserRequestDto })
  @ApiOkResponse({
    type: UpdateUserResponseDto,
    description: 'The updated user account.',
  })
  @ApiBadRequestResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OpenApiValidationErrorDto) },
        { $ref: getSchemaPath(NestBadRequestErrorDto) },
      ],
    },
  })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  updateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body(
      new ZodValidationPipe(updateUserRequestSchema, (issues) =>
        invalidUpdateUserRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateUserRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<UpdateUserResponseDto> {
    return this.userAdministrationService.updateUser(
      userId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/disable')
  @SerializeOptions({
    type: DisableUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Disable user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({
    type: DisableUserResponseDto,
    description: 'The disabled user account.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  disableUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<DisableUserResponseDto> {
    return this.userAdministrationService.disableUser(
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/reactivate')
  @SerializeOptions({
    type: ReactivateUserResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Reactivate user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({
    type: ReactivateUserResponseDto,
    description: 'The reactivated user account.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  reactivateUser(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ReactivateUserResponseDto> {
    return this.userAdministrationService.reactivateUser(
      userId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':userId/reset-password')
  @SerializeOptions({
    type: ResetUserPasswordResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Reset user password' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiBody({ type: ResetUserPasswordRequestDto })
  @ApiOkResponse({
    type: ResetUserPasswordResponseDto,
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
      new ZodValidationPipe(resetUserPasswordRequestSchema, (issues) =>
        invalidResetUserPasswordRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: ResetUserPasswordRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ResetUserPasswordResponseDto> {
    return this.userAdministrationService.resetUserPassword(
      userId,
      body,
      request.user,
      getRequestContext(request),
    )
  }
}
