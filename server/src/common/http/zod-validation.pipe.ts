import type { ArgumentMetadata, PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

export type ZodValidationExceptionFactory = (
  issues: z.core.$ZodIssue[],
) => Error

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: z.ZodType<T>,
    private readonly exceptionFactory: ZodValidationExceptionFactory,
  ) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw this.exceptionFactory(result.error.issues)
    }

    return result.data
  }
}
