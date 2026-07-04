const DEFAULT_API_BASE_URL = 'http://localhost:4000'

export type ClientEnv = {
  VITE_API_BASE_URL: string
}

type ImportMetaEnvLike = {
  VITE_API_BASE_URL?: string
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function readClientEnv(
  env: ImportMetaEnvLike = import.meta.env as ImportMetaEnvLike,
): ClientEnv {
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL

  return {
    VITE_API_BASE_URL: trimTrailingSlash(apiBaseUrl),
  }
}

export const clientEnv = readClientEnv()
