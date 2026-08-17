import { createHmac } from 'node:crypto'

const GEMINI_OPENAI_COMPATIBLE_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai'

export const MAX_GEMINI_CHAT_PROJECTS = 256
const MAX_GEMINI_CHAT_API_KEY_LENGTH = 4_096
const MAX_GEMINI_CHAT_PROJECT_ID_LENGTH = 120
const MIN_GEMINI_CHAT_API_KEY_LENGTH = 20
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,}$/u
const POOL_KEY_PREFIX = 'morshid:ai:gemini-chat:project-pool:'
const POOL_KEY_SALT = 'morshid:ai:gemini-chat:project-pool-key:v1'
const MEMBER_KEY_SALT = 'morshid:ai:gemini-chat:project-member-key:v1'
const DIGEST_HEX_LENGTH = 24
const STATE_TTL_MS = 24 * 60 * 60 * 1_000
const BASE_COOLDOWN_MS = 1_000
const MAX_COOLDOWN_MS = 30_000
const MAX_JITTER_MS = 250

export interface GeminiChatProject {
  readonly id: string
  readonly apiKey: string
}

interface GeminiChatProjectValidationIssue {
  readonly path: readonly (number | 'id' | 'apiKey')[]
  readonly message: string
}

type GeminiChatProjectValidationResult =
  | {
      readonly success: true
      readonly projects: readonly GeminiChatProject[]
    }
  | {
      readonly success: false
      readonly issues: readonly GeminiChatProjectValidationIssue[]
    }

export interface GeminiChatProjectPoolRedisClient {
  eval(
    script: string,
    options: {
      readonly keys: readonly string[]
      readonly arguments: readonly string[]
    },
  ): Promise<unknown>
}

export type GeminiChatProjectSelection =
  | {
      readonly kind: 'selected'
      readonly project: GeminiChatProject
    }
  | {
      readonly kind: 'exhausted'
      readonly retryAfterMs: number
    }

export interface GeminiChatProjectPoolPort {
  readonly size: number
  select(
    excludedProjectIds: ReadonlySet<string>,
  ): Promise<GeminiChatProjectSelection>
  markRateLimited(projectId: string, providerDelayMs: number): Promise<number>
}

export class GeminiChatProjectPoolUnavailableError extends Error {
  constructor() {
    super('Gemini chat project pool unavailable')
    Object.defineProperty(this, 'name', {
      configurable: true,
      value: 'GeminiChatProjectPoolUnavailableError',
    })
  }
}

const GEMINI_CHAT_PROJECT_SELECT_LUA = `
local ok, request = pcall(cjson.decode, ARGV[1])
if not ok or type(request) ~= 'table' or type(request.members) ~= 'table' or type(request.excluded) ~= 'table' then
  return { -1, 'invalid_request' }
end
if type(request.ttlMs) ~= 'number' or request.ttlMs < 1 or #request.members < 1 then
  return { -1, 'invalid_request' }
end

local excluded = {}
for _, member in ipairs(request.excluded) do
  if type(member) ~= 'string' then
    return { -1, 'invalid_request' }
  end
  excluded[member] = true
end

local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local cursor = redis.call('HINCRBY', KEYS[1], 'cursor', 1)
local start_index = ((cursor - 1) % #request.members) + 1
local earliest_retry_ms = nil

for offset = 0, #request.members - 1 do
  local index = ((start_index - 1 + offset) % #request.members) + 1
  local member = request.members[index]
  if type(member) ~= 'string' then
    return { -1, 'invalid_request' }
  end

  if not excluded[member] then
    local raw_cooldown = redis.call('HGET', KEYS[1], 'cooldown:' .. member)
    local cooldown_until_ms = 0
    if raw_cooldown ~= false then
      cooldown_until_ms = tonumber(raw_cooldown)
      if cooldown_until_ms == nil or cooldown_until_ms < 0 or cooldown_until_ms ~= math.floor(cooldown_until_ms) then
        return { -1, 'corrupt_state' }
      end
    end

    if cooldown_until_ms <= now_ms then
      redis.call('PEXPIRE', KEYS[1], math.floor(request.ttlMs))
      return { 1, tostring(index - 1) }
    end

    local retry_ms = cooldown_until_ms - now_ms
    if earliest_retry_ms == nil or retry_ms < earliest_retry_ms then
      earliest_retry_ms = retry_ms
    end
  end
end

redis.call('PEXPIRE', KEYS[1], math.floor(request.ttlMs))
return { 0, tostring(math.max(1, earliest_retry_ms or 1)) }
`

const GEMINI_CHAT_PROJECT_COOLDOWN_LUA = `
local ok, request = pcall(cjson.decode, ARGV[1])
if not ok or type(request) ~= 'table' or type(request.member) ~= 'string' then
  return { -1, 'invalid_request' }
end
if type(request.providerDelayMs) ~= 'number'
  or type(request.jitterMs) ~= 'number'
  or type(request.baseCooldownMs) ~= 'number'
  or type(request.maxCooldownMs) ~= 'number'
  or type(request.ttlMs) ~= 'number'
  or request.providerDelayMs < 0
  or request.jitterMs < 0
  or request.baseCooldownMs < 1
  or request.maxCooldownMs < request.baseCooldownMs
  or request.ttlMs < request.maxCooldownMs then
  return { -1, 'invalid_request' }
end

local redis_time = redis.call('TIME')
local now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
local failures_field = 'failures:' .. request.member
local last_failure_field = 'last_failure:' .. request.member
local raw_failures = redis.call('HGET', KEYS[1], failures_field)
local raw_last_failure = redis.call('HGET', KEYS[1], last_failure_field)
local failures = raw_failures == false and 0 or tonumber(raw_failures)
local last_failure_ms = raw_last_failure == false and nil or tonumber(raw_last_failure)
if failures == nil
  or failures < 0
  or failures ~= math.floor(failures)
  or (raw_last_failure ~= false and (
    last_failure_ms == nil
    or last_failure_ms < 0
    or last_failure_ms ~= math.floor(last_failure_ms)
  )) then
  return { -1, 'corrupt_state' }
end

if last_failure_ms == nil or now_ms - last_failure_ms > request.maxCooldownMs then
  failures = 0
end
failures = math.min(failures + 1, 16)

local exponential_ms = math.min(
  request.maxCooldownMs,
  (request.baseCooldownMs * math.pow(2, failures - 1)) + request.jitterMs
)
local cooldown_ms = math.min(
  request.maxCooldownMs,
  math.max(request.providerDelayMs, exponential_ms)
)
local cooldown_until_ms = now_ms + cooldown_ms
local cooldown_field = 'cooldown:' .. request.member
local raw_existing = redis.call('HGET', KEYS[1], cooldown_field)
if raw_existing ~= false then
  local existing = tonumber(raw_existing)
  if existing == nil or existing < 0 or existing ~= math.floor(existing) then
    return { -1, 'corrupt_state' }
  end
  cooldown_until_ms = math.max(cooldown_until_ms, existing)
end

redis.call(
  'HSET',
  KEYS[1],
  cooldown_field,
  tostring(cooldown_until_ms),
  failures_field,
  tostring(failures),
  last_failure_field,
  tostring(now_ms)
)
redis.call('PEXPIRE', KEYS[1], math.floor(request.ttlMs))
return { 1, tostring(math.max(1, cooldown_until_ms - now_ms)) }
`

interface ProjectSnapshot extends GeminiChatProject {
  readonly stateId: string
}

export class GeminiChatProjectPool implements GeminiChatProjectPoolPort {
  private readonly projects: readonly ProjectSnapshot[]
  private readonly stateKey: string

  constructor(
    private readonly redis: GeminiChatProjectPoolRedisClient,
    projects: readonly GeminiChatProject[],
    private readonly random: () => number = Math.random,
  ) {
    const validation = inspectGeminiChatProjects(projects)
    if (!validation.success) {
      throw new TypeError('Invalid Gemini chat project pool')
    }
    const validated = validation.projects
    this.projects = validated.map((project) =>
      Object.freeze({
        ...project,
        stateId: digest(MEMBER_KEY_SALT, project.id),
      }),
    )
    this.stateKey = `${POOL_KEY_PREFIX}${digest(
      POOL_KEY_SALT,
      validated
        .map((project) => project.id)
        .sort()
        .join('\u0000'),
    )}`
  }

  get size(): number {
    return this.projects.length
  }

  async select(
    excludedProjectIds: ReadonlySet<string>,
  ): Promise<GeminiChatProjectSelection> {
    const excluded = this.projects
      .filter((project) => excludedProjectIds.has(project.id))
      .map((project) => project.stateId)

    let raw: unknown
    try {
      raw = await this.redis.eval(GEMINI_CHAT_PROJECT_SELECT_LUA, {
        keys: [this.stateKey],
        arguments: [
          JSON.stringify({
            members: this.projects.map((project) => project.stateId),
            excluded,
            ttlMs: STATE_TTL_MS,
          }),
        ],
      })
    } catch {
      throw new GeminiChatProjectPoolUnavailableError()
    }

    const result = parsePoolReply(raw)
    if (result.status === 0) {
      return Object.freeze({
        kind: 'exhausted',
        retryAfterMs: result.value,
      })
    }
    if (result.value >= this.projects.length) {
      throw new GeminiChatProjectPoolUnavailableError()
    }

    const project = this.projects[result.value]
    return Object.freeze({
      kind: 'selected',
      project: Object.freeze({ id: project.id, apiKey: project.apiKey }),
    })
  }

  async markRateLimited(
    projectId: string,
    providerDelayMs: number,
  ): Promise<number> {
    const project = this.projects.find(
      (candidate) => candidate.id === projectId,
    )
    const random = this.random()
    if (
      project === undefined ||
      !Number.isFinite(providerDelayMs) ||
      providerDelayMs < 0 ||
      !Number.isFinite(random) ||
      random < 0 ||
      random >= 1
    ) {
      throw new GeminiChatProjectPoolUnavailableError()
    }

    let raw: unknown
    try {
      raw = await this.redis.eval(GEMINI_CHAT_PROJECT_COOLDOWN_LUA, {
        keys: [this.stateKey],
        arguments: [
          JSON.stringify({
            member: project.stateId,
            providerDelayMs: Math.min(
              Math.floor(providerDelayMs),
              MAX_COOLDOWN_MS,
            ),
            jitterMs: Math.floor(random * MAX_JITTER_MS),
            baseCooldownMs: BASE_COOLDOWN_MS,
            maxCooldownMs: MAX_COOLDOWN_MS,
            ttlMs: STATE_TTL_MS,
          }),
        ],
      })
    } catch {
      throw new GeminiChatProjectPoolUnavailableError()
    }

    const result = parsePoolReply(raw)
    if (result.status !== 1) {
      throw new GeminiChatProjectPoolUnavailableError()
    }
    return result.value
  }
}

export function isGeminiOpenAICompatibleBaseUrl(value: string): boolean {
  try {
    return (
      new URL(value).toString().replace(/\/+$/u, '') ===
      GEMINI_OPENAI_COMPATIBLE_BASE_URL
    )
  } catch {
    return false
  }
}

export function inspectGeminiChatProjects(
  value: unknown,
  options: { readonly allowEmpty?: boolean } = {},
): GeminiChatProjectValidationResult {
  if (!Array.isArray(value)) {
    return invalidProjects([], 'must be an array of project entries')
  }
  if (
    value.length > MAX_GEMINI_CHAT_PROJECTS ||
    (options.allowEmpty !== true && value.length === 0)
  ) {
    return invalidProjects(
      [],
      options.allowEmpty === true
        ? `must contain at most ${String(MAX_GEMINI_CHAT_PROJECTS)} projects`
        : `must contain between 1 and ${String(MAX_GEMINI_CHAT_PROJECTS)} projects`,
    )
  }

  const projects: GeminiChatProject[] = []
  const issues: GeminiChatProjectValidationIssue[] = []
  const ids = new Set<string>()
  const apiKeys = new Set<string>()
  for (const [index, rawCandidate] of value.entries()) {
    const candidate: unknown = rawCandidate
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      issues.push(validationIssue([index], 'must be a project object'))
      continue
    }
    const keys = Object.keys(candidate)
    if (keys.length !== 2 || !keys.includes('id') || !keys.includes('apiKey')) {
      issues.push(
        validationIssue([index], 'must contain only id and apiKey fields'),
      )
      continue
    }

    let id: unknown
    let apiKey: unknown
    try {
      id = Reflect.get(candidate, 'id')
      apiKey = Reflect.get(candidate, 'apiKey')
    } catch {
      issues.push(validationIssue([index], 'must be a readable project object'))
      continue
    }

    if (
      typeof id !== 'string' ||
      id.length > MAX_GEMINI_CHAT_PROJECT_ID_LENGTH ||
      !PROJECT_ID_PATTERN.test(id)
    ) {
      issues.push(
        validationIssue(
          [index, 'id'],
          `must be a lowercase opaque label of 3-${String(MAX_GEMINI_CHAT_PROJECT_ID_LENGTH)} letters, digits, or dashes`,
        ),
      )
    } else if (ids.has(id)) {
      issues.push(
        validationIssue(
          [index, 'id'],
          'must identify a distinct Google Cloud quota project',
        ),
      )
    } else {
      ids.add(id)
    }

    if (
      typeof apiKey !== 'string' ||
      apiKey.length < MIN_GEMINI_CHAT_API_KEY_LENGTH ||
      apiKey.length > MAX_GEMINI_CHAT_API_KEY_LENGTH ||
      apiKey.trim() !== apiKey ||
      !/^[\x21-\x7e]+$/u.test(apiKey)
    ) {
      issues.push(
        validationIssue(
          [index, 'apiKey'],
          `must be a printable API key of ${String(MIN_GEMINI_CHAT_API_KEY_LENGTH)}-${String(MAX_GEMINI_CHAT_API_KEY_LENGTH)} characters without whitespace`,
        ),
      )
    } else if (apiKeys.has(apiKey)) {
      issues.push(
        validationIssue(
          [index, 'apiKey'],
          'must be distinct within the Gemini chat project pool',
        ),
      )
    } else {
      apiKeys.add(apiKey)
    }

    if (typeof id === 'string' && typeof apiKey === 'string') {
      projects.push(Object.freeze({ id, apiKey }))
    }
  }

  return issues.length === 0
    ? { success: true, projects: Object.freeze(projects) }
    : { success: false, issues: Object.freeze(issues) }
}

export function inspectGeminiChatProjectsJson(
  value: unknown,
  options: { readonly allowEmpty?: boolean } = {},
): GeminiChatProjectValidationResult {
  if (
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return inspectGeminiChatProjects([], options)
  }
  if (typeof value !== 'string') {
    return inspectGeminiChatProjects(value, options)
  }
  try {
    return inspectGeminiChatProjects(JSON.parse(value) as unknown, options)
  } catch {
    return invalidProjects([], 'must be valid JSON containing a project array')
  }
}

function invalidProjects(
  path: readonly (number | 'id' | 'apiKey')[],
  message: string,
): GeminiChatProjectValidationResult {
  return {
    success: false,
    issues: Object.freeze([validationIssue(path, message)]),
  }
}

function validationIssue(
  path: readonly (number | 'id' | 'apiKey')[],
  message: string,
): GeminiChatProjectValidationIssue {
  return Object.freeze({ path: Object.freeze([...path]), message })
}

function parsePoolReply(value: unknown): { status: number; value: number } {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new GeminiChatProjectPoolUnavailableError()
  }
  const status = parseSafeInteger(value[0])
  const parsedValue = parseSafeInteger(value[1])
  if (
    status === null ||
    parsedValue === null ||
    parsedValue < 0 ||
    (status !== 0 && status !== 1)
  ) {
    throw new GeminiChatProjectPoolUnavailableError()
  }
  return { status, value: parsedValue }
}

function parseSafeInteger(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isSafeInteger(parsed)
    ? parsed
    : null
}

function digest(salt: string, value: string): string {
  return createHmac('sha256', salt)
    .update(value)
    .digest('hex')
    .slice(0, DIGEST_HEX_LENGTH)
}
