export function visibilityAwarePollingInterval(
  foregroundMs = 15_000,
  backgroundMs = 60_000,
) {
  return typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
    ? backgroundMs
    : foregroundMs
}
