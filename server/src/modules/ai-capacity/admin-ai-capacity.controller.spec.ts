import type { Response } from 'express'
import { AdminAiCapacityController } from './admin-ai-capacity.controller'
import { AI_CAPACITY_DISCLAIMER } from './ai-capacity.service'
import type { AiCapacityService } from './ai-capacity.service'

describe('AdminAiCapacityController', () => {
  let controller: AdminAiCapacityController
  let aiCapacityService: jest.Mocked<AiCapacityService>

  beforeEach(() => {
    aiCapacityService = {
      getAiCapacity: jest.fn().mockResolvedValue({
        overallStatus: 'Ready',
        disclaimer: AI_CAPACITY_DISCLAIMER,
        chatPool: {
          status: 'Ready',
          totalProjects: 2,
          availableProjects: 2,
          cooledDownProjects: 0,
          cooldownDetails: [],
        },
        embedding: {
          status: 'Ready',
          provider: 'deterministic',
          model: 'deterministic',
          dimensions: 1536,
        },
        observedAt: '2026-08-20T10:00:00.000Z',
      }),
    } as unknown as jest.Mocked<AiCapacityService>

    controller = new AdminAiCapacityController(aiCapacityService)
  })

  it('sets Cache-Control: no-store and returns capacity view', async () => {
    const setHeader = jest.fn()
    const response = { setHeader } as unknown as Response

    const result = await controller.getAiCapacity(response)

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(result.overallStatus).toBe('Ready')
  })
})
