import { ApiProperty } from '@nestjs/swagger'

export class OpenApiErrorDto {
  @ApiProperty({ example: 'INVALID_REQUEST' })
  code!: string

  @ApiProperty({ example: 'The request could not be processed' })
  message!: string
}

export class OpenApiValidationIssueDto {
  @ApiProperty({ example: 'body' })
  field!: string

  @ApiProperty({ example: 'Invalid input' })
  message!: string
}

export class OpenApiValidationErrorDto extends OpenApiErrorDto {
  @ApiProperty({ type: [OpenApiValidationIssueDto] })
  errors!: OpenApiValidationIssueDto[]
}

export class OpenApiIssuesErrorDto extends OpenApiErrorDto {
  @ApiProperty({ type: [OpenApiValidationIssueDto] })
  issues!: OpenApiValidationIssueDto[]
}

export class NestBadRequestErrorDto {
  @ApiProperty({ enum: [400], example: 400 })
  statusCode!: 400

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Validation failed (uuid v 4 is expected)',
  })
  message!: string | string[]

  @ApiProperty({ enum: ['Bad Request'], example: 'Bad Request' })
  error!: 'Bad Request'
}
