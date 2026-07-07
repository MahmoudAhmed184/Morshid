import { loginSchema } from './login.dto'

describe('loginSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const result = loginSchema.parse({
      email: 'admin@morshid.demo',
      password: 'MorshidDemoP0!',
    })

    expect(result).toEqual({
      email: 'admin@morshid.demo',
      password: 'MorshidDemoP0!',
    })
  })

  it('rejects invalid login payloads', () => {
    expect(() =>
      loginSchema.parse({
        email: 'not-an-email',
        password: 'MorshidDemoP0!',
      }),
    ).toThrow()

    expect(() =>
      loginSchema.parse({
        email: 'admin@morshid.demo',
        password: '',
      }),
    ).toThrow()
  })
})
