import {
  GeminiQuotaService as SharedGeminiQuotaService,
  type GeminiQuotaCaps,
  type GeminiQuotaNamespace,
  type GeminiQuotaRedisClient,
} from './gemini-quota.service'
import {
  GEMINI_COMPLETION_QUOTA_NAMESPACE,
  GeminiQuotaService as CompletionGeminiQuotaService,
} from '../../modules/completion/providers/gemini/gemini-quota.service'

const caps: GeminiQuotaCaps = {
  requestsPerMinute: 5,
  inputTokensPerMinute: 500,
  requestsPerHour: 10,
  requestsPerDay: 20,
  requestsPerMonth: 40,
}

const EMBEDDING_NAMESPACE: GeminiQuotaNamespace = Object.freeze({
  keyPrefix: 'morshid:embedding:gemini:quota:',
  keySalt: 'morshid:embedding:gemini:quota-key:v1',
})

/**
 * Records what the guard actually asked Redis to do, and replays a hash so a
 * second instance can observe the first one's stored budget.
 *
 * This is deliberately not a model of the Lua script — the script's semantics
 * are covered against a real Redis in
 * `server/test/gemini-quota-script.e2e-spec.ts`. Here it exists only so a
 * reservation made through the extracted implementation can be shown to land on
 * the same key and the same fields as one made before the extraction.
 */
class RecordingFakeRedis implements GeminiQuotaRedisClient {
  readonly hashes = new Map<string, Map<string, string>>()
  readonly keys: string[] = []

  eval(
    _script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown> {
    const key = options.keys[0]
    this.keys.push(key)

    const request = JSON.parse(options.arguments[0]) as {
      readonly dimensions: readonly {
        readonly name: string
        readonly mode: string
        readonly capacity: number
        readonly cost: number
      }[]
    }
    const hash = this.hashes.get(key) ?? new Map<string, string>()

    for (const dimension of request.dimensions) {
      if (dimension.mode === 'token_bucket') {
        const field = `${dimension.name}:tokens`
        const stored = hash.get(field)
        // No refill: the fake clock never advances, so a second reservation
        // must see exactly what the first one left behind.
        const tokens =
          stored === undefined ? dimension.capacity : Number(stored)
        if (dimension.cost > 0 && tokens < dimension.cost) {
          return Promise.resolve([0, dimension.name])
        }
        hash.set(field, String(tokens - dimension.cost))
        continue
      }

      const field = `${dimension.name}:used`
      const used = Number(hash.get(field) ?? '0')
      if (dimension.cost > 0 && used + dimension.cost > dimension.capacity) {
        return Promise.resolve([0, dimension.name])
      }
      hash.set(field, String(used + dimension.cost))
    }

    this.hashes.set(key, hash)
    return Promise.resolve([1, 'ok'])
  }
}

describe('shared GeminiQuotaService namespacing', () => {
  describe('completion Redis-key compatibility', () => {
    // Captured from the implementation as it stood BEFORE the extraction, for
    // a fixed credential. These literals are the whole point of the test: every
    // deployment's partially spent day and month windows already live under
    // this key, so a change to the prefix, the salt, the `credential:` identity
    // prefix, the HMAC, or the truncation length silently hands that deployment
    // a fresh budget. If this assertion fails, the extraction was not
    // behaviour-preserving — do not update the literal.
    it('derives byte-identical keys for a fixed credential', () => {
      const quota = new CompletionGeminiQuotaService(
        new RecordingFakeRedis(),
        caps,
        { credential: 'AIzaSyFIXED-compat-credential' },
      )

      expect(quota.quotaKey).toBe(
        'morshid:completion:gemini:quota:7efb944550c62f5a8c0c1966',
      )
    })

    it('derives byte-identical keys for the legacy model identity', () => {
      const quota = new CompletionGeminiQuotaService(
        new RecordingFakeRedis(),
        caps,
        'gemini-3.5-flash-lite',
      )

      expect(quota.quotaKey).toBe(
        'morshid:completion:gemini:quota:57efcc26a8d2d24e59577227',
      )
    })

    it('pins the completion namespace strings themselves', () => {
      expect(GEMINI_COMPLETION_QUOTA_NAMESPACE).toEqual({
        keyPrefix: 'morshid:completion:gemini:quota:',
        keySalt: 'morshid:completion:gemini:quota-key:v2',
      })
    })

    // The digest assertion above is necessary but not sufficient: a matching
    // key proves nothing if the extracted implementation writes different hash
    // fields into it. This drives an existing budget forward instead.
    it('observes and increments an existing budget rather than starting a parallel one', async () => {
      const redis = new RecordingFakeRedis()
      const before = new CompletionGeminiQuotaService(redis, caps, {
        credential: 'AIzaSyFIXED-compat-credential',
      })
      await before.reserveGeneration(100)

      const seededKey = before.quotaKey
      const seededHash = redis.hashes.get(seededKey)
      expect(seededHash?.get('requests_day:used')).toBe('1')
      expect(seededHash?.get('input_tokens_minute:tokens')).toBe('400')

      // A separately constructed instance — the extracted implementation
      // reached through completion's namespace — must land on the same key and
      // continue the same counters.
      const after = new SharedGeminiQuotaService(
        redis,
        caps,
        { credential: 'AIzaSyFIXED-compat-credential' },
        GEMINI_COMPLETION_QUOTA_NAMESPACE,
      )
      await after.reserveGeneration(100)

      expect(after.quotaKey).toBe(seededKey)
      expect(redis.hashes.size).toBe(1)
      expect(redis.keys).toEqual([seededKey, seededKey])
      expect(seededHash?.get('requests_day:used')).toBe('2')
      expect(seededHash?.get('input_tokens_minute:tokens')).toBe('300')
    })

    it('exhausts the shared budget from either instance', async () => {
      const redis = new RecordingFakeRedis()
      const tightCaps: GeminiQuotaCaps = { ...caps, requestsPerDay: 1 }
      const before = new CompletionGeminiQuotaService(redis, tightCaps, {
        credential: 'AIzaSyFIXED-compat-credential',
      })
      const after = new SharedGeminiQuotaService(
        redis,
        tightCaps,
        { credential: 'AIzaSyFIXED-compat-credential' },
        GEMINI_COMPLETION_QUOTA_NAMESPACE,
      )

      await before.reserveRequest()

      await expect(after.reserveRequest()).rejects.toMatchObject({
        kind: 'quota_exhausted',
        dimension: 'requests_day',
      })
    })
  })

  describe('namespace and identity separation', () => {
    it('keeps two namespaces off each other’s buckets for one identity', () => {
      const redis = new RecordingFakeRedis()
      const completion = new SharedGeminiQuotaService(
        redis,
        caps,
        { credential: 'shared-credential' },
        GEMINI_COMPLETION_QUOTA_NAMESPACE,
      )
      const embedding = new SharedGeminiQuotaService(
        redis,
        caps,
        { credential: 'shared-credential' },
        EMBEDDING_NAMESPACE,
      )

      expect(completion.quotaKey).not.toBe(embedding.quotaKey)
      expect(embedding.quotaKey.startsWith(EMBEDDING_NAMESPACE.keyPrefix)).toBe(
        true,
      )
    })

    it('shares one bucket across every instance naming the same project', () => {
      const redis = new RecordingFakeRedis()
      const replicaOne = new SharedGeminiQuotaService(
        redis,
        caps,
        { project: 'embedding-project-01' },
        EMBEDDING_NAMESPACE,
      )
      const replicaTwo = new SharedGeminiQuotaService(
        redis,
        caps,
        { project: 'embedding-project-01' },
        EMBEDDING_NAMESPACE,
      )

      expect(replicaOne.quotaKey).toBe(replicaTwo.quotaKey)
    })

    it('separates two projects in one namespace', () => {
      const redis = new RecordingFakeRedis()
      const first = new SharedGeminiQuotaService(
        redis,
        caps,
        { project: 'embedding-project-01' },
        EMBEDDING_NAMESPACE,
      )
      const second = new SharedGeminiQuotaService(
        redis,
        caps,
        { project: 'embedding-project-02' },
        EMBEDDING_NAMESPACE,
      )

      expect(first.quotaKey).not.toBe(second.quotaKey)
    })

    // A project label that happens to equal a credential must not collide with
    // it: the identity kind is part of the hashed input, not just documentation.
    it('separates a project label from an identical credential', () => {
      const redis = new RecordingFakeRedis()
      const byCredential = new SharedGeminiQuotaService(
        redis,
        caps,
        { credential: 'same-value' },
        EMBEDDING_NAMESPACE,
      )
      const byProject = new SharedGeminiQuotaService(
        redis,
        caps,
        { project: 'same-value' },
        EMBEDDING_NAMESPACE,
      )

      expect(byCredential.quotaKey).not.toBe(byProject.quotaKey)
    })

    it('never puts the identity itself in the key', () => {
      const redis = new RecordingFakeRedis()
      const quota = new SharedGeminiQuotaService(
        redis,
        caps,
        { credential: 'AIzaSy-secret-credential-value' },
        EMBEDDING_NAMESPACE,
      )

      expect(quota.quotaKey).not.toContain('AIzaSy')
      expect(quota.quotaKey).not.toContain('secret')
    })
  })
})
