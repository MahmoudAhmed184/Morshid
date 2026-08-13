import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
} from '../../../common/http/openapi-error.dto'
import { getRequestContext } from '../../../common/http/request-context'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import {
  MaterialAdministrationListResponseDto,
  MaterialAdministrationResponseDto,
  UpdateMaterialAdministrationRequestDto,
  updateMaterialAdministrationRequestSchema,
  type UpdateMaterialAdministrationRequest,
} from './material-administration.types'
import { invalidMaterialsRequestException } from './materials.errors'
import { MaterialsService } from './materials.service'

@Controller('admin/courses/:courseId/materials')
@ApiTags('materials')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class MaterialAdministrationController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  @SerializeOptions({
    type: MaterialAdministrationListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List course materials for administration' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({ type: MaterialAdministrationListResponseDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  listMaterials(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialAdministrationListResponseDto> {
    return this.materialsService.listMaterialsForAdministration(
      courseId,
      request.user,
    )
  }

  @Get(':materialId')
  @SerializeOptions({
    type: MaterialAdministrationResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get a course material for administration' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiOkResponse({ type: MaterialAdministrationResponseDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialAdministrationResponseDto> {
    return this.materialsService.getMaterialForAdministration(
      courseId,
      materialId,
      request.user,
    )
  }

  @Patch(':materialId')
  @SerializeOptions({
    type: MaterialAdministrationResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update a course material for administration' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiBody({ type: UpdateMaterialAdministrationRequestDto })
  @ApiOkResponse({ type: MaterialAdministrationResponseDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  updateMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Body(
      new ZodValidationPipe(
        updateMaterialAdministrationRequestSchema,
        (issues) =>
          invalidMaterialsRequestException(
            issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          ),
      ),
    )
    body: UpdateMaterialAdministrationRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialAdministrationResponseDto> {
    return this.materialsService.updateMaterialForAdministration(
      courseId,
      materialId,
      body,
      request.user,
      getRequestContext(request),
    )
  }
}
