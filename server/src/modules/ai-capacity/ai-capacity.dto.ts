import { ApiProperty } from '@nestjs/swagger'

export type AiReadinessStatus = 'Ready' | 'Pressured' | 'Blocked' | 'Unknown'

export class AiCapacityProjectCooldownDto {
  @ApiProperty({
    description: 'Opaque index of the project in the configured pool (0..N-1)',
  })
  projectIndex!: number

  @ApiProperty({ description: 'Remaining cooldown time in milliseconds' })
  cooldownRemainingMs!: number

  @ApiProperty({
    description: 'Timestamp when cooldown expires, ISO-8601',
    nullable: true,
  })
  cooldownUntil!: string | null
}

export class AiCapacityChatPoolDto {
  @ApiProperty({ enum: ['Ready', 'Pressured', 'Blocked', 'Unknown'] })
  status!: AiReadinessStatus

  @ApiProperty({ description: 'Total number of configured upstream projects' })
  totalProjects!: number

  @ApiProperty({
    description: 'Number of upstream projects currently available',
  })
  availableProjects!: number

  @ApiProperty({
    description: 'Number of upstream projects currently in cooldown',
  })
  cooledDownProjects!: number

  @ApiProperty({
    type: [AiCapacityProjectCooldownDto],
    description: 'Details of projects in cooldown',
  })
  cooldownDetails!: AiCapacityProjectCooldownDto[]
}

export class AiCapacityQuotaDimensionDto {
  @ApiProperty({
    description: 'Dimension name (e.g. requests_minute, requests_day)',
  })
  name!: string

  @ApiProperty({
    description: 'Quota meter mode: token_bucket or fixed_window',
  })
  mode!: string

  @ApiProperty({ description: 'Configured capacity limit for this window' })
  capacity!: number

  @ApiProperty({
    description:
      'Current available tokens (token_bucket) or used requests (fixed_window)',
  })
  availableOrUsed!: number

  @ApiProperty({ description: 'Window duration in milliseconds' })
  windowMs!: number

  @ApiProperty({ enum: ['Ready', 'Pressured', 'Blocked'] })
  status!: 'Ready' | 'Pressured' | 'Blocked'
}

export class AiCapacityEmbeddingDto {
  @ApiProperty({ enum: ['Ready', 'Pressured', 'Blocked', 'Unknown'] })
  status!: AiReadinessStatus

  @ApiProperty({
    description: 'Configured embedding provider (e.g. gemini, deterministic)',
  })
  provider!: string

  @ApiProperty({ description: 'Configured embedding model name' })
  model!: string

  @ApiProperty({ description: 'Vector dimension count (e.g. 768)' })
  dimensions!: number

  @ApiProperty({ type: [AiCapacityQuotaDimensionDto], required: false })
  quotaDimensions?: AiCapacityQuotaDimensionDto[]
}

export class AiCapacityResponseDto {
  @ApiProperty({ enum: ['Ready', 'Pressured', 'Blocked', 'Unknown'] })
  overallStatus!: AiReadinessStatus

  @ApiProperty({ description: 'Operator operational view disclaimer' })
  disclaimer!: string

  @ApiProperty({ type: AiCapacityChatPoolDto })
  chatPool!: AiCapacityChatPoolDto

  @ApiProperty({ type: AiCapacityEmbeddingDto })
  embedding!: AiCapacityEmbeddingDto

  @ApiProperty({ description: 'Observation timestamp, ISO-8601' })
  observedAt!: string
}
