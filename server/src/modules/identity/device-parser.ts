/**
 * Parses a user-agent header into a human-readable browser and OS label.
 * Returns 'Unknown device' for malformed or unrecognized user agents.
 */
export function parseDevice(userAgent: string | null | undefined): string {
  if (
    userAgent === null ||
    userAgent === undefined ||
    typeof userAgent !== 'string'
  ) {
    return 'Unknown device'
  }

  const trimmed = userAgent.trim()
  if (trimmed === '' || !/[a-zA-Z0-9]/.test(trimmed)) {
    return 'Unknown device'
  }

  const browser = detectBrowser(trimmed)
  const os = detectOperatingSystem(trimmed)

  if (browser !== null && os !== null) {
    return `${browser} on ${os}`
  }

  if (browser !== null) {
    return browser
  }

  if (os !== null) {
    return os
  }

  return 'Unknown device'
}

/**
 * Masks an IP address to protect user privacy.
 * - IPv4: replaces the last octet with '***' (e.g. '192.168.1.***')
 * - IPv6: preserves the prefix and masks host bits (e.g. '2001:db8:85a3:***')
 */
export function maskIp(ip: string | null | undefined): string | null {
  if (ip === null || ip === undefined || typeof ip !== 'string') {
    return null
  }

  const trimmed = ip.trim()
  if (trimmed === '') {
    return null
  }

  // Handle IPv4-mapped IPv6 address (e.g. ::ffff:192.168.1.1 or ::ffff:127.0.0.1)
  const ipv4MappedMatch = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(
    trimmed,
  )
  const effectiveIp = ipv4MappedMatch !== null ? ipv4MappedMatch[1] : trimmed

  // Check IPv4
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    effectiveIp,
  )
  if (ipv4Match !== null) {
    return `${ipv4Match[1]}.${ipv4Match[2]}.${ipv4Match[3]}.***`
  }

  // Check IPv6
  if (effectiveIp.includes(':')) {
    if (effectiveIp === '::1' || effectiveIp === '::') {
      return '::***'
    }

    const segments = effectiveIp.split(':')
    const preserved = segments
      .slice(0, Math.min(3, segments.length))
      .filter(Boolean)
    return preserved.length > 0 ? `${preserved.join(':')}:***` : '::***'
  }

  return '***'
}

function detectBrowser(ua: string): string | null {
  if (/edg(?:e|ios|a)?\//i.test(ua)) {
    return 'Edge'
  }
  if (/(?:opera|opr)\//i.test(ua)) {
    return 'Opera'
  }
  if (/(?:chrome|crios)\//i.test(ua) && !/chromium/i.test(ua)) {
    return 'Chrome'
  }
  if (/(?:firefox|fxios)\//i.test(ua)) {
    return 'Firefox'
  }
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    return 'Safari'
  }
  return null
}

function detectOperatingSystem(ua: string): string | null {
  if (/(?:iphone|ipad|ipod)/i.test(ua)) {
    return 'iOS'
  }
  if (/android/i.test(ua)) {
    return 'Android'
  }
  if (/(?:macintosh|mac os x)/i.test(ua)) {
    return 'macOS'
  }
  if (/(?:windows nt|win32|win64)/i.test(ua)) {
    return 'Windows'
  }
  if (/cros/i.test(ua)) {
    return 'ChromeOS'
  }
  if (/(?:linux|x11)/i.test(ua)) {
    return 'Linux'
  }
  return null
}
