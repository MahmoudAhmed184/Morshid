import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { UserRole } from '../../generated/prisma/client'
import { Roles } from '../auth/roles.decorator'
import { MaterialUploadConfigurationService } from './material-upload-configuration.service'
import { MaterialUploadConfigurationDto } from './materials.dto'

@Controller('materials/upload-configuration')
@ApiTags('materials')
@Roles(UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({
  type: MaterialUploadConfigurationDto,
  strategy: 'excludeAll',
})
export class MaterialUploadConfigurationController {
  constructor(
    private readonly configurationService: MaterialUploadConfigurationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get effective PDF upload constraints' })
  @ApiOkResponse({
    type: MaterialUploadConfigurationDto,
    description: 'The PDF constraints enforced by this server instance.',
  })
  getConfiguration(): MaterialUploadConfigurationDto {
    return this.configurationService.getConfiguration()
  }
}
