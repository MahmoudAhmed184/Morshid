export const MaterialStatus = {
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  WARNING: 'WARNING',
  FAILED: 'FAILED',
} as const

export type MaterialStatus =
  (typeof MaterialStatus)[keyof typeof MaterialStatus]
