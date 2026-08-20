import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { AppEnvironment } from '../../platform/config/env.schema'
import { RedisService } from '../../platform/cache/redis.service'
import {
  GeminiChatProjectPool,
  inspectGeminiChatProjectsJson,
  type GeminiChatPoolSnapshot,
} from '../../platform/ai/upstream/gemini-chat-project-pool'
import {
  GeminiQuotaService,
  type GeminiQuotaCaps,
  type GeminiQuotaSnapshot,
} from '../../platform/ai/gemini/gemini-quota.service'
import {
  GEMINI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_QUOTA_NAMESPACE,
} from '../../platform/ai/embedding/providers/gemini/gemini-embedding.constants'
import { EMBEDDING_DIMENSIONS } from '../../platform/ai/embedding/embedding-provider'
import type {
  AiCapacityResponseDto,
  AiReadinessStatus,
} from './ai-capacity.dto'

export const AI_CAPACITY_DISCLAIMER =
  'Local operational view based on in-memory and cache state. Actual upstream Google Cloud quotas, billing accounts, and project configurations are managed in Google Cloud Console and may differ.'

@Injectable()
export class AiCapacityService {
  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly redisService: RedisService,
  ) {}

  async getAiCapacity(): Promise<AiCapacityResponseDto> {
    const observedAt = new Date().toISOString()
    const chatPool = await this.observeChatPool()
    const embedding = await this.observeEmbedding()

    let overallStatus: AiReadinessStatus = 'Unknown'
    if (chatPool.status === 'Blocked' || embedding.status === 'Blocked') {
      overallStatus = 'Blocked'
    } else if (
      chatPool.status === 'Pressured' ||
      embedding.status === 'Pressured'
    ) {
      overallStatus = 'Pressured'
    } else if (chatPool.status === 'Ready' && embedding.status === 'Ready') {
      overallStatus = 'Ready'
    } else if (chatPool.status === 'Ready' || embedding.status === 'Ready') {
      overallStatus = 'Ready'
    }

    return {
      overallStatus,
      disclaimer: AI_CAPACITY_DISCLAIMER,
      chatPool,
      embedding,
      observedAt,
    }
  }

  private async observeChatPool(): Promise<AiCapacityResponseDto['chatPool']> {
    const rawProjectsJson = this.configService.get(
      'GEMINI_CHAT_PROJECTS_JSON',
      { infer: true },
    )

    const validated = inspectGeminiChatProjectsJson(rawProjectsJson, {
      allowEmpty: true,
    })

    if (!validated.success || validated.projects.length === 0) {
      return {
        status: 'Unknown',
        totalProjects: 0,
        availableProjects: 0,
        cooledDownProjects: 0,
        cooldownDetails: [],
      }
    }

    const redis = {
      eval: (
        script: string,
        options: { keys: readonly string[]; arguments: readonly string[] },
      ) =>
        this.redisService.getClient().eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    }

    try {
      const pool = new GeminiChatProjectPool(redis, validated.projects)
      const snapshot: GeminiChatPoolSnapshot = await pool.snapshot()

      return {
        status: snapshot.status,
        totalProjects: snapshot.totalProjects,
        availableProjects: snapshot.availableProjects,
        cooledDownProjects: snapshot.cooledDownProjects,
        cooldownDetails: snapshot.cooldownDetails.map((detail) => ({
          projectIndex: detail.projectIndex,
          cooldownRemainingMs: detail.cooldownRemainingMs,
          cooldownUntil:
            detail.cooldownUntilMs > 0
              ? new Date(detail.cooldownUntilMs).toISOString()
              : null,
        })),
      }
    } catch {
      return {
        status: 'Unknown',
        totalProjects: validated.projects.length,
        availableProjects: 0,
        cooledDownProjects: 0,
        cooldownDetails: [],
      }
    }
  }

  private async observeEmbedding(): Promise<
    AiCapacityResponseDto['embedding']
  > {
    const provider = this.configService.get('EMBEDDING_PROVIDER', {
      infer: true,
    })

    if (provider !== 'gemini') {
      return {
        status: 'Ready',
        provider,
        model: 'deterministic',
        dimensions: EMBEDDING_DIMENSIONS,
      }
    }

    const quotaProjectId =
      this.configService.get('GEMINI_EMBEDDING_QUOTA_PROJECT_ID', {
        infer: true,
      }) ?? 'default-embedding-project'
    const model = GEMINI_EMBEDDING_MODEL

    const redis = {
      eval: (
        script: string,
        options: { keys: readonly string[]; arguments: readonly string[] },
      ) =>
        this.redisService.getClient().eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    }

    const caps: GeminiQuotaCaps = {
      requestsPerMinute: this.configService.get(
        'GEMINI_EMBEDDING_REQUESTS_PER_MINUTE',
        {
          infer: true,
        },
      ),
      inputTokensPerMinute: this.configService.get(
        'GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE',
        {
          infer: true,
        },
      ),
      requestsPerHour: this.configService.get(
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_HOUR',
        {
          infer: true,
        },
      ),
      requestsPerDay: this.configService.get(
        'GEMINI_EMBEDDING_REQUESTS_PER_DAY',
        {
          infer: true,
        },
      ),
      requestsPerMonth: this.configService.get(
        'GEMINI_EMBEDDING_LOCAL_REQUESTS_PER_30_DAYS',
        {
          infer: true,
        },
      ),
    }

    try {
      const quotaService = new GeminiQuotaService(
        redis,
        caps,
        { project: quotaProjectId },
        GEMINI_EMBEDDING_QUOTA_NAMESPACE,
      )
      const snapshot: GeminiQuotaSnapshot = await quotaService.snapshot()

      return {
        status: snapshot.status,
        provider: 'gemini',
        model,
        dimensions: EMBEDDING_DIMENSIONS,
        quotaDimensions: snapshot.dimensions.map((dim) => ({
          name: dim.name,
          mode: dim.mode,
          capacity: dim.capacity,
          availableOrUsed: dim.availableOrUsed,
          windowMs: dim.windowMs,
          status: dim.status,
        })),
      }
    } catch {
      return {
        status: 'Unknown',
        provider: 'gemini',
        model,
        dimensions: EMBEDDING_DIMENSIONS,
      }
    }
  }
}
