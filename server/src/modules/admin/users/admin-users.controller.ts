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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { z } from 'zod'

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
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @SerializeOptions({ type: AdminUserListResponseDto, strategy: 'excludeAll' })
  @ApiOkResponse({ type: AdminUserListResponseDto })
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
  @ApiBody({ type: AdminCreateUserRequestDto })
  @ApiCreatedResponse({ type: AdminCreateUserResponseDto })
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
  @ApiOkResponse({ type: AdminDisableUserResponseDto })
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
  @ApiOkResponse({ type: AdminReactivateUserResponseDto })
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
  @ApiBody({ type: AdminResetUserPasswordRequestDto })
  @ApiOkResponse({ type: AdminResetUserPasswordResponseDto })
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
