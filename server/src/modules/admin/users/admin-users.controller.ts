import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  SerializeOptions,
  UseInterceptors,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { z } from 'zod'

import { UserRole } from '../../../generated/prisma/client'
import { getRequestContext } from '../../auth/auth.controller'
import type { AuthenticatedHttpRequest } from '../../auth/auth.guard'
import { Roles } from '../../auth/roles.decorator'
import {
  AdminCreateUserRequestDto,
  AdminCreateUserResponseDto,
  AdminDisableUserResponseDto,
  AdminUserListResponseDto,
  adminCreateUserRequestSchema,
  type AdminCreateUserRequest,
} from './admin-users.dto'
import {
  invalidAdminCreateUserRequestException,
  type AdminUsersValidationIssue,
} from './admin-users.errors'
import { AdminUsersService } from './admin-users.service'

class AdminUsersValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw invalidAdminCreateUserRequestException(
        result.error.issues.map(mapZodIssue),
      )
    }

    return result.data
  }
}

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
@SerializeOptions({ type: AdminCreateUserResponseDto, strategy: 'excludeAll' })
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @SerializeOptions({ type: AdminUserListResponseDto, strategy: 'excludeAll' })
  @ApiOkResponse({ type: AdminUserListResponseDto })
  listUsers(): Promise<AdminUserListResponseDto> {
    return this.adminUsersService.listUsers()
  }

  @Post()
  @ApiBody({ type: AdminCreateUserRequestDto })
  @ApiCreatedResponse({ type: AdminCreateUserResponseDto })
  createUser(
    @Body(new AdminUsersValidationPipe(adminCreateUserRequestSchema))
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
  @SerializeOptions({ type: AdminDisableUserResponseDto, strategy: 'excludeAll' })
  @ApiOkResponse({ type: AdminDisableUserResponseDto })
  disableUser(
    @Param('userId') userId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AdminDisableUserResponseDto> {
    return this.adminUsersService.disableUser(
      userId,
      request.user,
      getRequestContext(request),
    )
  }
}
