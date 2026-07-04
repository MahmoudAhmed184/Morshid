import { describe, expect, it } from 'vitest'

import { fetchReadinessStatus } from './health'

describe('fetchReadinessStatus', () => {
  it('requests the NestJS readiness endpoint', async () => {
    const fetchMock = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://localhost:4000/health/ready')

      return Response.json({
        status: 'ok',
        details: {
          database: {
            status: 'up',
          },
        },
      })
    }

    await expect(fetchReadinessStatus(fetchMock)).resolves.toMatchObject({
      status: 'ok',
    })
  })

  it('throws on non-2xx readiness responses', async () => {
    const fetchMock = async () =>
      new Response('unavailable', {
        status: 503,
      })

    await expect(fetchReadinessStatus(fetchMock)).rejects.toMatchObject({
      name: 'ApiHealthError',
      status: 503,
    })
  })
})
