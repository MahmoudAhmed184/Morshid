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

/**
 * Time-aware greeting title used on the student home. Includes the first name
 * when known (`Good evening, Sara.`) and omits it otherwise (`Good evening.`).
 */
export function timeAwareGreeting(
  firstName?: string,
  now: Date = new Date(),
): string {
  const hour = now.getHours()
  const salutation =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return firstName ? `${salutation}, ${firstName}.` : `${salutation}.`
}
