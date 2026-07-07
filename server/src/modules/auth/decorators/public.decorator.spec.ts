import { Reflector } from '@nestjs/core'

import { IS_PUBLIC_KEY, Public } from './public.decorator'

describe('Public', () => {
  it('sets public metadata on route handlers', () => {
    class TestController {
      @Public()
      handler() {
        return undefined
      }
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'handler',
    )

    if (descriptor === undefined || typeof descriptor.value !== 'function') {
      throw new Error('Expected handler descriptor')
    }

    const handler = descriptor.value as unknown as () => undefined
    const reflector = new Reflector()

    expect(reflector.get(IS_PUBLIC_KEY, handler)).toBe(true)
  })
})
