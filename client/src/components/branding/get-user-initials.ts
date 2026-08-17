/**
 * Derive up to two uppercase initials from a display name, falling back to
 * `fallback` when the name is missing or yields no letters.
 */
export function getUserInitials(displayName?: string, fallback = 'U') {
  if (!displayName) {
    return fallback
  }

  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || fallback
  )
}
