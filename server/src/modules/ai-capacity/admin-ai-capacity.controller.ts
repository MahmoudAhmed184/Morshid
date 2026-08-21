import { Controller, Get, Res } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { Roles, UserRole } from '../identity/identity.roles'
import { AiCapacityService } from './ai-capacity.service'
import { AiCapacityResponseDto } from './ai-capacity.dto'

@Controller('admin/ai-capacity')
@ApiTags('ai-capacity')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
export class AdminAiCapacityController {
  constructor(private readonly aiCapacityService: AiCapacityService) {}

  @Get()
  @ApiOperation({
    summary: 'Get local operational AI capacity and readiness view',
  })
  @ApiOkResponse({
    description:
      'Current local operational view of chat pool and embedding capacity.',
    type: AiCapacityResponseDto,
  })
  async getAiCapacity(
    @Res({ passthrough: true }) response: Response,
  ): Promise<AiCapacityResponseDto> {
    response.setHeader('Cache-Control', 'no-store')
    return this.aiCapacityService.getAiCapacity()
  }
}
