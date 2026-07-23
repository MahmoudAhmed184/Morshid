/**
 * Derive the student's first name from their display name. Returns `undefined`
 * when no usable name is available so greeting copy can fall back gracefully.
 */
export function firstNameFromDisplayName(
  displayName?: string,
): string | undefined {
  const first = displayName?.trim().split(/\s+/).filter(Boolean)[0]
  return first && first.length > 0 ? first : undefined
}
