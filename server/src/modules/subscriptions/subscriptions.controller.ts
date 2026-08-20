import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
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
  ApiExtraModels,
  ApiForbiddenResponse,
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
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  GlobalPricingDto,
  MySubscriptionResponseDto,
  SubscriptionListResponseDto,
  SubscriptionInvoiceListResponseDto,
  UniversitySubscriptionItemDto,
  UpdateGlobalPricingRequestDto,
  UpdateUniversitySubscriptionRequestDto,
  listSubscriptionsQuerySchema,
  listUniversityInvoicesQuerySchema,
  updateGlobalPricingSchema,
  updateUniversitySubscriptionSchema,
  type ListSubscriptionsQuery,
  type ListUniversityInvoicesQuery,
  type UpdateGlobalPricingRequest,
  type UpdateUniversitySubscriptionRequest,
} from './subscriptions.types'
import {
  invalidSubscriptionsRequestException,
  type SubscriptionsValidationIssue,
} from './subscriptions.errors'
import { SubscriptionsService } from './subscriptions.service'

function mapZodIssue(issue: z.core.$ZodIssue): SubscriptionsValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}

const bodyOrRouteParamBadRequestSchema = {
  schema: {
    oneOf: [
      { $ref: getSchemaPath(OpenApiValidationErrorDto) },
      { $ref: getSchemaPath(NestBadRequestErrorDto) },
    ],
  },
}

@Controller('subscriptions')
@ApiTags('subscriptions')
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('global-pricing')
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({ type: GlobalPricingDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Get global default subscription pricing' })
  @ApiOkResponse({
    type: GlobalPricingDto,
    description: 'The global seat pricing configuration.',
  })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  getGlobalPricing(): Promise<GlobalPricingDto> {
    return this.subscriptionsService.getGlobalPricing()
  }

  @Patch('global-pricing')
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({ type: GlobalPricingDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Update global default subscription pricing' })
  @ApiBody({ type: UpdateGlobalPricingRequestDto })
  @ApiOkResponse({
    type: GlobalPricingDto,
    description: 'The updated global seat pricing configuration.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  updateGlobalPricing(
    @Body(
      new ZodValidationPipe(updateGlobalPricingSchema, (issues) =>
        invalidSubscriptionsRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateGlobalPricingRequest,
  ): Promise<GlobalPricingDto> {
    return this.subscriptionsService.updateGlobalPricing(body)
  }

  @Post('invoices/:invoiceId/paid')
  @HttpCode(204)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a subscription invoice payment' })
  @ApiParam({ name: 'invoiceId', format: 'uuid' })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  async markInvoicePaid(
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' }))
    invoiceId: string,
  ): Promise<void> {
    await this.subscriptionsService.markInvoicePaid(invoiceId)
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({
    type: SubscriptionListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List all university subscriptions and usage' })
  @ApiOkResponse({
    type: SubscriptionListResponseDto,
    description:
      'A paginated list of university subscriptions with peak metrics.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  listSubscriptions(
    @Query(
      new ZodValidationPipe(listSubscriptionsQuerySchema, (issues) =>
        invalidSubscriptionsRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListSubscriptionsQuery,
  ): Promise<SubscriptionListResponseDto> {
    return this.subscriptionsService.listSubscriptions(query)
  }

  @Get('universities/:universityId')
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({
    type: UniversitySubscriptionItemDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get specific university subscription details' })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiOkResponse({
    type: UniversitySubscriptionItemDto,
    description: 'University subscription details with peak usage.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  getUniversitySubscription(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
  ): Promise<UniversitySubscriptionItemDto> {
    return this.subscriptionsService.getUniversitySubscription(universityId)
  }

  @Get('universities/:universityId/invoices')
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({
    type: SubscriptionInvoiceListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List all invoices for a university subscription' })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiOkResponse({ type: SubscriptionInvoiceListResponseDto })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  listUniversityInvoices(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
    @Query(
      new ZodValidationPipe(listUniversityInvoicesQuerySchema, (issues) =>
        invalidSubscriptionsRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListUniversityInvoicesQuery,
  ): Promise<SubscriptionInvoiceListResponseDto> {
    return this.subscriptionsService.listUniversityInvoices(universityId, query)
  }

  @Patch('universities/:universityId')
  @Roles(UserRole.SUPER_ADMIN)
  @SerializeOptions({
    type: UniversitySubscriptionItemDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary: 'Update custom pricing or status for university subscription',
  })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiBody({ type: UpdateUniversitySubscriptionRequestDto })
  @ApiOkResponse({
    type: UniversitySubscriptionItemDto,
    description: 'The updated university subscription.',
  })
  @ApiBadRequestResponse(bodyOrRouteParamBadRequestSchema)
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  updateUniversitySubscription(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
    @Body(
      new ZodValidationPipe(updateUniversitySubscriptionSchema, (issues) =>
        invalidSubscriptionsRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateUniversitySubscriptionRequest,
  ): Promise<UniversitySubscriptionItemDto> {
    return this.subscriptionsService.updateUniversitySubscription(
      universityId,
      body,
    )
  }

  @Get('my-subscription')
  @Roles(UserRole.ADMIN)
  @SerializeOptions({
    type: MySubscriptionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary: 'Get current university subscription and peak billing estimates',
  })
  @ApiOkResponse({
    type: MySubscriptionResponseDto,
    description:
      'Current university subscription, rate, peak seats, and estimated bill.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  getMySubscription(
    @Req() req: AuthenticatedHttpRequest,
  ): Promise<MySubscriptionResponseDto> {
    return this.subscriptionsService.getMySubscription(req.user.universityId)
  }

  @Post('my-subscription/cancel')
  @Roles(UserRole.ADMIN)
  @SerializeOptions({
    type: MySubscriptionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary:
      'Schedule university subscription cancellation at the end of the current billing cycle',
  })
  @ApiOkResponse({
    type: MySubscriptionResponseDto,
    description: 'The subscription is set to cancel at period end.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  cancelMySubscription(
    @Req() req: AuthenticatedHttpRequest,
  ): Promise<MySubscriptionResponseDto> {
    return this.subscriptionsService.cancelMySubscription(req.user.universityId)
  }

  @Post('my-subscription/resume')
  @Roles(UserRole.ADMIN)
  @SerializeOptions({
    type: MySubscriptionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary: 'Resume a scheduled-to-cancel university subscription',
  })
  @ApiOkResponse({
    type: MySubscriptionResponseDto,
    description:
      'The subscription cancellation schedule is reversed to active.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  resumeMySubscription(
    @Req() req: AuthenticatedHttpRequest,
  ): Promise<MySubscriptionResponseDto> {
    return this.subscriptionsService.resumeMySubscription(req.user.universityId)
  }
}
