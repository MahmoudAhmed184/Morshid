import { BadRequestException, Injectable } from '@nestjs/common'
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || 'body',
          message: issue.message,
        })),
      })
    }

    return result.data
  }
}
