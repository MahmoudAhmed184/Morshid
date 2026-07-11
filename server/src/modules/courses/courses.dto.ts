import { ApiProperty } from '@nestjs/swagger'
import { Expose, Type } from 'class-transformer'

import {
  CourseMembershipRole,
  UserRole,
  UserStatus,
} from '../../generated/prisma/client'

export class CourseUserSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'email' })
  email!: string

  @Expose()
  @ApiProperty()
  displayName!: string

  @Expose()
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole

  @Expose()
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status!: UserStatus
}

export class CourseMembershipSummaryDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty({ format: 'uuid' })
  userId!: string

  @Expose()
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
  })
  role!: CourseMembershipRole

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @Type(() => CourseUserSummaryDto)
  @ApiProperty({ type: CourseUserSummaryDto })
  user!: CourseUserSummaryDto
}

export class CourseAdminMetadataDto {
  @Expose()
  @ApiProperty({ format: 'uuid', nullable: true })
  createdById!: string | null

  @Expose()
  @Type(() => CourseUserSummaryDto)
  @ApiProperty({ type: CourseUserSummaryDto, nullable: true })
  createdBy!: CourseUserSummaryDto | null

  @Expose()
  @ApiProperty({ format: 'date-time' })
  createdAt!: string

  @Expose()
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string

  @Expose()
  @Type(() => CourseMembershipSummaryDto)
  @ApiProperty({ type: [CourseMembershipSummaryDto] })
  memberships!: CourseMembershipSummaryDto[]

  @Expose()
  @ApiProperty({ minimum: 0 })
  memberCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  instructorCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  studentCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  materialCount!: number

  @Expose()
  @ApiProperty({ minimum: 0 })
  activeMaterialCount!: number
}

export class CourseListItemDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id!: string

  @Expose()
  @ApiProperty()
  code!: string

  @Expose()
  @ApiProperty()
  title!: string

  @Expose()
  @ApiProperty({
    enum: CourseMembershipRole,
    enumName: 'CourseMembershipRole',
    nullable: true,
  })
  membershipRole!: CourseMembershipRole | null

  @Expose()
  @Type(() => CourseAdminMetadataDto)
  @ApiProperty({ type: CourseAdminMetadataDto, required: false })
  adminMetadata?: CourseAdminMetadataDto
}

export class CourseListResponseDto {
  @Expose()
  @Type(() => CourseListItemDto)
  @ApiProperty({ type: [CourseListItemDto] })
  courses!: CourseListItemDto[]
}
