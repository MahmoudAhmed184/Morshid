import type { ConfigService } from '@nestjs/config'
import type { RedisService } from '../../platform/cache/redis.service'
import {
  AiCapacityService,
  AI_CAPACITY_DISCLAIMER,
} from './ai-capacity.service'

describe('AiCapacityService', () => {
  let service: AiCapacityService
  let configService: jest.Mocked<ConfigService>
  let redisService: jest.Mocked<RedisService>

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'GEMINI_CHAT_PROJECTS_JSON') {
          return JSON.stringify([
            { id: 'proj-01', apiKey: 'secret-api-key-1-value' },
            { id: 'proj-02', apiKey: 'secret-api-key-2-value' },
          ])
        }
        if (key === 'EMBEDDING_PROVIDER') {
          return 'deterministic'
        }
        return undefined
      }),
    } as unknown as jest.Mocked<ConfigService>

    redisService = {
      getClient: jest.fn().mockReturnValue({
        eval: jest.fn().mockResolvedValue([
          1,
          JSON.stringify([
            [0, 0, 0],
            [1, 0, 0],
          ]),
        ]),
      }),
    } as unknown as jest.Mocked<RedisService>

    service = new AiCapacityService(configService, redisService)
  })

  it('returns ready status and never reveals credentials', async () => {
    const result = await service.getAiCapacity()

    expect(result.disclaimer).toBe(AI_CAPACITY_DISCLAIMER)
    expect(result.overallStatus).toBe('Ready')
    expect(result.chatPool).toEqual({
      status: 'Ready',
      totalProjects: 2,
      availableProjects: 2,
      cooledDownProjects: 0,
      cooldownDetails: [],
    })
    expect(result.embedding).toEqual({
      status: 'Ready',
      provider: 'deterministic',
      model: 'deterministic',
      dimensions: 1536,
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('proj-01')
    expect(serialized).not.toContain('proj-02')
    expect(serialized).not.toContain('secret-api-key')
  })
})
