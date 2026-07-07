import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

import { ZodValidationPipe } from './zod-validation.pipe'

describe('ZodValidationPipe', () => {
  it('returns parsed data for valid input', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        page: z.coerce.number().int().min(1),
      }),
    )

    expect(pipe.transform({ page: '2' })).toEqual({ page: 2 })
  })

  it('throws a bad request exception with formatted Zod issues', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        email: z.email(),
        password: z.string().min(1),
      }),
    )

    expect(() =>
      pipe.transform({
        email: 'not-an-email',
        password: '',
      }),
    ).toThrow(BadRequestException)

    try {
      pipe.transform({
        email: 'not-an-email',
        password: '',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'Validation failed',
        errors: [
          {
            path: 'email',
          },
          {
            path: 'password',
          },
        ],
      })
    }
  })
})
