import {
  DEFAULT_ANALYSIS_MODEL_BASE_URL,
  DEFAULT_ANALYSIS_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_ANALYSIS_MODEL_NAME,
} from './socratic-workflow/analysis-model.configuration'
import {
  DEFAULT_SEMANTIC_GUARD_BASE_URL,
  DEFAULT_SEMANTIC_GUARD_MAX_COMPLETION_TOKENS,
  DEFAULT_SEMANTIC_GUARD_MODEL_NAME,
} from './socratic-workflow/semantic-guard.configuration'
import {
  DEFAULT_TUTOR_MODEL_BASE_URL,
  DEFAULT_TUTOR_MODEL_MAX_COMPLETION_TOKENS,
  DEFAULT_TUTOR_MODEL_NAME,
} from './socratic-workflow/tutor-model.configuration'
import { parseTutoringConfiguration } from './tutoring.configuration'

describe('parseTutoringConfiguration', () => {
  it('applies deterministic defaults for every tutoring role', () => {
    expect(parseTutoringConfiguration({ NODE_ENV: 'test' })).toMatchObject({
      NODE_ENV: 'test',
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
})
