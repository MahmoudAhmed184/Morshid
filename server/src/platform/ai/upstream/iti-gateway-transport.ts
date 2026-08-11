// The URL and credential policy for the ITI-operated gateway, shared by every
// module that talks to it. This is a security boundary — an SSRF guard and a
// plaintext-credential guard — so it may not exist in two copies that can
// drift: a rule relaxed here must be relaxed for completion and embedding at
// once, and a rule tightened here must tighten both.

// The single ITI-operated gateway. HTTPS deployments stay configurable so a
// staging gateway can be pointed at, but the insecure HTTP exception is pinned
// to exactly this host and path.
export const ITI_GATEWAY_HOST = 'apiaccess.iti.net.eg'
export const ITI_GATEWAY_PATH = '/api/v1'
export const DEFAULT_ITI_GATEWAY_BASE_URL = `https://${ITI_GATEWAY_HOST}${ITI_GATEWAY_PATH}`

export const MAX_ITI_GATEWAY_API_KEY_LENGTH = 4_096
export const MAX_ITI_GATEWAY_BASE_URL_LENGTH = 2_048

// The key is sent as an `Authorization` header value on every request, and the
// Headers constructor throws on anything outside Latin-1. Requiring printable
// ASCII keeps that failure at startup instead of once per request, and
// subsumes the control-character and surrounding-whitespace rules.
const MIN_PRINTABLE_ASCII_CODE_POINT = 0x21
const MAX_PRINTABLE_ASCII_CODE_POINT = 0x7e

export type UpstreamEnvironment = 'development' | 'test' | 'production'

export function validateItiGatewayBaseUrl(
  value: string,
  environment: UpstreamEnvironment,
  allowInsecureHttp: boolean,
): URL {
  const url = new URL(value)
  // WHATWG sets `search`/`hash` to '' for a *bare* `?` or `#` while keeping the
  // delimiter in the serialization, so a base URL of `https://host/collect#`
  // would turn the endpoint into `https://host/collect#/student/chat` and send
  // the bearer-authenticated POST to the wrong path. Reject on the
  // serialization instead of the components.
  const serialized = url.toString()
  if (
    url.username !== '' ||
    url.password !== '' ||
    serialized.includes('?') ||
    serialized.includes('#')
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  // Defence in depth: the gateway URL must stay configurable for staging, but
  // it may never address the local host or a private/link-local network, or a
  // stale value would ship the bearer key to a metadata service.
  if (isPrivateNetworkHostname(url.hostname)) {
    throw new TypeError('Invalid gateway URL')
  }

  if (url.protocol === 'https:') {
    return url
  }

  const normalizedPath = url.pathname.replace(/\/+$/u, '')
  if (
    !isInsecureItiGatewayBaseUrl(serialized) ||
    environment === 'production' ||
    !allowInsecureHttp ||
    url.hostname !== ITI_GATEWAY_HOST ||
    url.port !== '' ||
    normalizedPath !== ITI_GATEWAY_PATH
  ) {
    throw new TypeError('Invalid gateway URL')
  }

  return url
}

// The single owner of "is this transport insecure?", shared by the base-URL
// policy above and by the modules that emit the startup warning. `new URL()`
// lower-cases the scheme, so `HTTP://apiaccess.iti.net.eg/api/v1` — which
// `z.url()` accepts verbatim and which really does put the bearer key on the
// wire in plaintext — is recognized here, unlike a raw string prefix test.
export function isInsecureItiGatewayBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).protocol === 'http:'
  } catch {
    // An unparseable value never reaches a request: startup validation rejects
    // it, so there is no insecure transport to warn about.
    return false
  }
}

export function isValidItiGatewayApiKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ITI_GATEWAY_API_KEY_LENGTH &&
    isPrintableAscii(value)
  )
}

function isPrintableAscii(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (
      codePoint === undefined ||
      codePoint < MIN_PRINTABLE_ASCII_CODE_POINT ||
      codePoint > MAX_PRINTABLE_ASCII_CODE_POINT
    ) {
      return false
    }
  }
  return true
}

function isPrivateNetworkHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    return isPrivateIpv6Address(host.slice(1, -1))
  }

  const octets = parseIpv4Address(host)
  return octets !== undefined && isPrivateIpv4Address(octets)
}

function parseIpv4Address(
  host: string,
): readonly [number, number, number, number] | undefined {
  // `URL` normalizes every accepted IPv4 spelling (`127.1`, `0x7f.0.0.1`) into
  // dotted-decimal, so matching the normalized hostname is sufficient.
  const parts = host.split('.')
  if (parts.length !== 4) {
    return undefined
  }

  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) {
      return undefined
    }
    const octet = Number.parseInt(part, 10)
    if (octet > 255) {
      return undefined
    }
    octets.push(octet)
  }

  return [octets[0], octets[1], octets[2], octets[3]] as const
}

function isPrivateIpv4Address(
  octets: readonly [number, number, number, number],
): boolean {
  const [first, second] = octets
  return (
    first === 0 || // 0.0.0.0/8, including the unspecified address
    first === 10 || // 10.0.0.0/8
    first === 127 || // 127.0.0.0/8 loopback
    (first === 169 && second === 254) || // 169.254.0.0/16 link-local metadata
    (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
    (first === 192 && second === 168) // 192.168.0.0/16
  )
}

const IPV6_UNIQUE_LOCAL_MASK = 0xfe00
const IPV6_UNIQUE_LOCAL_PREFIX = 0xfc00
const IPV6_LINK_LOCAL_MASK = 0xffc0
const IPV6_LINK_LOCAL_PREFIX = 0xfe80

function isPrivateIpv6Address(address: string): boolean {
  // `URL` emits the canonical compressed lower-case form, so an address that
  // still compresses from the front is unspecified (`::`), loopback (`::1`),
  // IPv4-compatible, or IPv4-mapped — never a public gateway.
  if (address.startsWith('::')) {
    return true
  }

  const [firstGroupText] = address.split(':')
  const firstGroup = Number.parseInt(firstGroupText, 16)
  if (!Number.isInteger(firstGroup)) {
    return true
  }

  return (
    (firstGroup & IPV6_UNIQUE_LOCAL_MASK) === IPV6_UNIQUE_LOCAL_PREFIX || // fc00::/7
    (firstGroup & IPV6_LINK_LOCAL_MASK) === IPV6_LINK_LOCAL_PREFIX // fe80::/10
  )
}
