export const DEFAULT_MODEL_TIMEOUT_MS = 30_000
export const MAX_MODEL_TIMEOUT_MS = 120_000

export function hasAtMostCodePoints(value: string, maximum: number): boolean {
  return Array.from(value).length <= maximum
}

export function readAbortSignalAborted(signal: AbortSignal): boolean {
  return signal.aborted
}
