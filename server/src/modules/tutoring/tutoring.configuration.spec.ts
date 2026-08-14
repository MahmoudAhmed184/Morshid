import {
  DEFAULT_ANALYSIS_MODEL_BASE_URL,
  DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_ANALYSIS_MODEL_NAME,
} from './infrastructure/analysis-model.configuration'
import {
  DEFAULT_SEMANTIC_GUARD_BASE_URL,
  DEFAULT_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
  DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
} from './infrastructure/semantic-guard.configuration'
import {
  DEFAULT_TUTOR_MODEL_BASE_URL,
  DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_TUTOR_MODEL_NAME,
} from './infrastructure/tutor-model.configuration'
import { parseTutoringConfiguration } from './tutoring.configuration'

const geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai'

const geminiProjects = Object.freeze([
  Object.freeze({
    id: 'chat-project-01',
    apiKey: 'first-secret-api-key-value',
  }),
  Object.freeze({
    id: 'chat-project-02',
    apiKey: 'second-secret-api-key-value',
  }),
])

const geminiRoleConfigurations = [
  {
    role: 'analysis',
    apiKeyPath: 'ANALYSIS_MODEL_API_KEY',
    configuration: {
      ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
      ANALYSIS_MODEL_BASE_URL: geminiBaseUrl,
      ANALYSIS_MODEL_NAME: 'gemini-analysis-model',
    },
  },
  {
    role: 'tutor',
    apiKeyPath: 'TUTOR_MODEL_API_KEY',
    configuration: {
      TUTOR_MODEL_PROVIDER: 'openai-compatible',
      TUTOR_MODEL_BASE_URL: geminiBaseUrl,
      TUTOR_MODEL_NAME: 'gemini-tutor-model',
    },
  },
  {
    role: 'semantic guard',
    apiKeyPath: 'SEMANTIC_GUARD_API_KEY',
    configuration: {
      SEMANTIC_GUARD_PROVIDER: 'openai-compatible',
      SEMANTIC_GUARD_BASE_URL: geminiBaseUrl,
      SEMANTIC_GUARD_MODEL_NAME: 'gemini-guard-model',
    },
  },
] as const

describe('parseTutoringConfiguration', () => {
  it('applies deterministic defaults for every tutoring role', () => {
    expect(parseTutoringConfiguration({ NODE_ENV: 'test' })).toMatchObject({
      NODE_ENV: 'test',
      GEMINI_CHAT_PROJECTS_JSON: [],
      ANALYSIS_MODEL_PROVIDER: 'deterministic',
      ANALYSIS_MODEL_BASE_URL: DEFAULT_ANALYSIS_MODEL_BASE_URL,
      ANALYSIS_MODEL_NAME: DEFAULT_ANALYSIS_MODEL_NAME,
      ANALYSIS_MODEL_API_KEY: '',
      ANALYSIS_MODEL_MAX_COMPLETION_TOKENS:
        DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
      TUTOR_MODEL_PROVIDER: 'deterministic',
      TUTOR_MODEL_BASE_URL: DEFAULT_TUTOR_MODEL_BASE_URL,
      TUTOR_MODEL_NAME: DEFAULT_TUTOR_MODEL_NAME,
      TUTOR_MODEL_API_KEY: '',
      TUTOR_MODEL_MAX_COMPLETION_TOKENS:
        DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
      SEMANTIC_GUARD_PROVIDER: 'deterministic',
      SEMANTIC_GUARD_BASE_URL: DEFAULT_SEMANTIC_GUARD_BASE_URL,
      SEMANTIC_GUARD_MODEL_NAME: DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
      SEMANTIC_GUARD_API_KEY: '',
      SEMANTIC_GUARD_MAX_COMPLETION_TOKENS:
        DEFAULT_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
    })
  })

  it('coerces independent model budgets', () => {
    expect(
      parseTutoringConfiguration({
        ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: '1024',
        TUTOR_MODEL_MAX_COMPLETION_TOKENS: '1024',
        SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: '512',
      }),
    ).toMatchObject({
      ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: 1024,
      TUTOR_MODEL_MAX_COMPLETION_TOKENS: 1024,
      SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: 512,
    })

    expect(() =>
      parseTutoringConfiguration({
        ANALYSIS_MODEL_MAX_COMPLETION_TOKENS: '63',
      }),
    ).toThrow(/ANALYSIS_MODEL_MAX_COMPLETION_TOKENS/)
    expect(() =>
      parseTutoringConfiguration({ TUTOR_MODEL_MAX_COMPLETION_TOKENS: '2049' }),
    ).toThrow(/TUTOR_MODEL_MAX_COMPLETION_TOKENS/)
    expect(() =>
      parseTutoringConfiguration({
        SEMANTIC_GUARD_MAX_COMPLETION_TOKENS: '1025',
      }),
    ).toThrow(/SEMANTIC_GUARD_MAX_COMPLETION_TOKENS/)
  })

  it('requires safe, distinct live model roles', () => {
    expect(() =>
      parseTutoringConfiguration({
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: 'https://models.example.test/v1',
        ANALYSIS_MODEL_NAME: 'analysis-model',
        ANALYSIS_MODEL_API_KEY: 'replace-with-analysis-key',
        TUTOR_MODEL_PROVIDER: 'openai-compatible',
        TUTOR_MODEL_BASE_URL: 'https://models.example.test/v1',
        TUTOR_MODEL_NAME: 'tutor-model',
        SEMANTIC_GUARD_PROVIDER: 'openai-compatible',
        SEMANTIC_GUARD_BASE_URL: 'https://models.example.test/v1',
        SEMANTIC_GUARD_MODEL_NAME: 'guard-model',
      }),
    ).toThrow(/ANALYSIS_MODEL_API_KEY/)

    expect(() =>
      parseTutoringConfiguration({
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: 'https://models.example.test/v1',
        ANALYSIS_MODEL_NAME: 'same-model',
        TUTOR_MODEL_PROVIDER: 'openai-compatible',
        TUTOR_MODEL_BASE_URL: 'https://models.example.test/v1',
        TUTOR_MODEL_NAME: 'same-model',
      }),
    ).toThrow(/TUTOR_MODEL_NAME/)
  })

  it('requires live providers for production', () => {
    expect(() =>
      parseTutoringConfiguration({ NODE_ENV: 'production' }),
    ).toThrow(/ANALYSIS_MODEL_PROVIDER|TUTOR_MODEL_PROVIDER/)
  })

  it.each(geminiRoleConfigurations)(
    'wires the project-aware credential pool into the $role role',
    ({ configuration, apiKeyPath }) => {
      expect(
        parseTutoringConfiguration({
          ...configuration,
          GEMINI_CHAT_PROJECTS_JSON: JSON.stringify(geminiProjects),
        }),
      ).toMatchObject({
        [apiKeyPath]: '',
        GEMINI_CHAT_PROJECTS_JSON: geminiProjects,
      })
    },
  )

  it.each(geminiRoleConfigurations)(
    'rejects missing or stale single-key configuration for the $role Gemini role',
    ({ configuration, apiKeyPath }) => {
      expect(() => parseTutoringConfiguration(configuration)).toThrow(
        /GEMINI_CHAT_PROJECTS_JSON/,
      )

      expect(() =>
        parseTutoringConfiguration({
          ...configuration,
          [apiKeyPath]: 'single-secret-api-key-value',
          GEMINI_CHAT_PROJECTS_JSON: JSON.stringify(geminiProjects),
        }),
      ).toThrow(new RegExp(apiKeyPath, 'u'))
    },
  )

  it('rejects unused or duplicate Gemini project pools', () => {
    expect(() =>
      parseTutoringConfiguration({
        GEMINI_CHAT_PROJECTS_JSON: JSON.stringify(geminiProjects),
      }),
    ).toThrow(/GEMINI_CHAT_PROJECTS_JSON/)

    expect(() =>
      parseTutoringConfiguration({
        ANALYSIS_MODEL_PROVIDER: 'openai-compatible',
        ANALYSIS_MODEL_BASE_URL: geminiBaseUrl,
        ANALYSIS_MODEL_NAME: 'gemini-analysis-model',
        GEMINI_CHAT_PROJECTS_JSON: JSON.stringify([
          geminiProjects[0],
          { ...geminiProjects[1], id: geminiProjects[0].id },
        ]),
      }),
    ).toThrow(/GEMINI_CHAT_PROJECTS_JSON/)
  })

  it('uses the same strict project-entry validation as direct pool construction', () => {
    expect(() =>
      parseTutoringConfiguration({
        ...geminiRoleConfigurations[0].configuration,
        GEMINI_CHAT_PROJECTS_JSON: JSON.stringify([
          { ...geminiProjects[0], extra: 'not-allowed' },
        ]),
      }),
    ).toThrow(/GEMINI_CHAT_PROJECTS_JSON/)
  })
})
