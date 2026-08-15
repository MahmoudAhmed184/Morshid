import { maskIp, parseDevice } from './device-parser'

describe('parseDevice', () => {
  it('returns "Unknown device" for null, undefined, or empty strings', () => {
    expect(parseDevice(null)).toBe('Unknown device')
    expect(parseDevice(undefined)).toBe('Unknown device')
    expect(parseDevice('')).toBe('Unknown device')
    expect(parseDevice('   ')).toBe('Unknown device')
    expect(parseDevice('???')).toBe('Unknown device')
  })

  it('parses Chrome on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    expect(parseDevice(ua)).toBe('Chrome on macOS')
  })

  it('parses Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
    expect(parseDevice(ua)).toBe('Safari on macOS')
  })

  it('parses Firefox on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
    expect(parseDevice(ua)).toBe('Firefox on Windows')
  })

  it('parses Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
    expect(parseDevice(ua)).toBe('Edge on Windows')
  })

  it('parses Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36'
    expect(parseDevice(ua)).toBe('Chrome on Android')
  })

  it('parses Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    expect(parseDevice(ua)).toBe('Safari on iOS')
  })

  it('parses Firefox on Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0'
    expect(parseDevice(ua)).toBe('Firefox on Linux')
  })

  it('falls back to "Unknown device" for unrecognized user agent formats', () => {
    expect(parseDevice('curl/7.68.0')).toBe('Unknown device')
    expect(parseDevice('PostmanRuntime/7.29.2')).toBe('Unknown device')
  })
})

describe('maskIp', () => {
  it('returns null for null, undefined, or empty IP', () => {
    expect(maskIp(null)).toBeNull()
    expect(maskIp(undefined)).toBeNull()
    expect(maskIp('')).toBeNull()
    expect(maskIp('  ')).toBeNull()
  })

  it('masks IPv4 addresses', () => {
    expect(maskIp('192.168.1.100')).toBe('192.168.1.***')
    expect(maskIp('127.0.0.1')).toBe('127.0.0.***')
    expect(maskIp('10.0.0.1')).toBe('10.0.0.***')
  })

  it('masks IPv4-mapped IPv6 addresses', () => {
    expect(maskIp('::ffff:192.168.1.1')).toBe('192.168.1.***')
    expect(maskIp('::ffff:127.0.0.1')).toBe('127.0.0.***')
  })

  it('masks IPv6 addresses', () => {
    expect(maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
      '2001:0db8:85a3:***',
    )
    expect(maskIp('::1')).toBe('::***')
  })
})
