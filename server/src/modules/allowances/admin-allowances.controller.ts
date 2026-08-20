import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { getRequestContext } from '../../common/http/request-context'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  createAllowanceResetSchema,
  setCoursePolicyOverrideSchema,
  studentUsageQuerySchema,
  updateDeploymentDefaultsSchema,
  type CreateAllowanceResetDto,
  type SetCoursePolicyOverrideDto,
  type StudentUsageQueryDto,
  type UpdateDeploymentDefaultsDto,
} from './admin-allowances.dto'
import {
  AllowancesService,
  type AllowancePoliciesDto,
  type StudentCourseUsageDto,
  type AllowanceResetRecord,
  type CourseOverrideRecord,
  type DeploymentDefaultsRecord,
} from './allowances.service'

@Controller('admin/allowances')
@ApiTags('allowances')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
export class AdminAllowancesController {
  constructor(private readonly allowancesService: AllowancesService) {}

  @Get('policies')
  @ApiOperation({
    summary: 'Get deployment defaults and course allowance overrides',
  })
  @ApiOkResponse({ description: 'The current allowance policy configuration.' })
  getPolicies(): Promise<AllowancePoliciesDto> {
    return this.allowancesService.getPolicies()
  }

  @Patch('policies/defaults')
  @ApiOperation({ summary: 'Update deployment allowance defaults' })
  @ApiBody({ description: 'New deployment allowance defaults.' })
  @ApiOkResponse({ description: 'The updated deployment defaults.' })
  @ApiBadRequestResponse({ description: 'Invalid limit values.' })
  updateDeploymentDefaults(
    @Body(
      new ZodValidationPipe(
        updateDeploymentDefaultsSchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid allowance defaults payload',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          }),
      ),
    )
    body: UpdateDeploymentDefaultsDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<DeploymentDefaultsRecord> {
    return this.allowancesService.updateDeploymentDefaults(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Put('policies/courses/:courseId')
  @ApiOperation({ summary: 'Create or update course policy override' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({ description: 'The updated course policy override.' })
  @ApiBadRequestResponse({ description: 'Invalid limit values.' })
  setCourseOverride(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Body(
      new ZodValidationPipe(
        setCoursePolicyOverrideSchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid course override payload',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          }),
      ),
    )
    body: SetCoursePolicyOverrideDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseOverrideRecord> {
    return this.allowancesService.setCourseOverride(
      courseId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Delete('policies/courses/:courseId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete course policy override' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The course override was deleted.' })
  @ApiNotFoundResponse({ description: 'Course override not found.' })
  async removeCourseOverride(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<void> {
    await this.allowancesService.removeCourseOverride(
      courseId,
      request.user,
      getRequestContext(request),
    )
  }

  @Post('resets')
  @ApiOperation({
    summary: 'Create an audited student allowance reset for a course',
  })
  @ApiCreatedResponse({ description: 'The created allowance reset record.' })
  @ApiBadRequestResponse({
    description: 'Invalid reset parameters or missing reason.',
  })
  createAllowanceReset(
    @Body(
      new ZodValidationPipe(
        createAllowanceResetSchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid allowance reset payload',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'body',
              message: issue.message,
            })),
          }),
      ),
    )
    body: CreateAllowanceResetDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AllowanceResetRecord> {
    return this.allowancesService.createAllowanceReset(
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Get('student-usage')
  @ApiOperation({
    summary: 'Get current student usage and limits for a course',
  })
  @ApiOkResponse({
    description: 'Current tutoring and review allowance state.',
  })
  getStudentUsage(
    @Query(
      new ZodValidationPipe(
        studentUsageQuerySchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid student usage query',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'query',
              message: issue.message,
            })),
          }),
      ),
    )
    query: StudentUsageQueryDto,
  ): Promise<StudentCourseUsageDto> {
    return this.allowancesService.getStudentUsage(
      query.studentId,
      query.courseId,
    )
  }
}
