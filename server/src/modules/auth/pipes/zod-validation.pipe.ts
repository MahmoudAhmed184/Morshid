import {
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common'
import type { z } from 'zod'

import { invalidAuthRequestException } from '../auth.errors'

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw invalidAuthRequestException()
    }

    return result.data
  }
}
