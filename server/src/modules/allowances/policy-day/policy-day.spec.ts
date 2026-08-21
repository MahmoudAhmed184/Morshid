import { resolvePolicyDayWindow } from './policy-day'

describe('PolicyDay calculation', () => {
  describe('Africa/Cairo', () => {
    it('calculates policy day window correctly during DST (+03:00)', () => {
      // 2026-08-20 12:00:00 Cairo time is 2026-08-20 09:00:00 UTC
      const now = new Date('2026-08-20T09:00:00.000Z')
      const window = resolvePolicyDayWindow(now, 'Africa/Cairo')

      // Midnight 2026-08-20 00:00:00 +03:00 is 2026-08-19 21:00:00 UTC
      expect(window.start.toISOString()).toBe('2026-08-19T21:00:00.000Z')
      // Next midnight 2026-08-21 00:00:00 +03:00 is 2026-08-20 21:00:00 UTC
      expect(window.end.toISOString()).toBe('2026-08-20T21:00:00.000Z')
      expect(window.resetAt.toISOString()).toBe('2026-08-20T21:00:00.000Z')
      expect(window.policyTimeZone).toBe('Africa/Cairo')
    })

    it('handles instant right at midnight in Cairo', () => {
      // Exactly 2026-08-20 00:00:00 +03:00 (2026-08-19 21:00:00 UTC)
      const midnight = new Date('2026-08-19T21:00:00.000Z')
      const window = resolvePolicyDayWindow(midnight, 'Africa/Cairo')

      expect(window.start.toISOString()).toBe('2026-08-19T21:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-08-20T21:00:00.000Z')
    })

    it('handles 1 millisecond before midnight in Cairo', () => {
      // 2026-08-19 20:59:59.999 UTC is 2026-08-19 23:59:59.999 +03:00 (previous day)
      const beforeMidnight = new Date('2026-08-19T20:59:59.999Z')
      const window = resolvePolicyDayWindow(beforeMidnight, 'Africa/Cairo')

      expect(window.start.toISOString()).toBe('2026-08-18T21:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-08-19T21:00:00.000Z')
    })

    it('calculates winter standard time (+02:00) window correctly', () => {
      // 2026-01-15 12:00:00 Cairo time is 2026-01-15 10:00:00 UTC
      const winterNow = new Date('2026-01-15T10:00:00.000Z')
      const window = resolvePolicyDayWindow(winterNow, 'Africa/Cairo')

      // Midnight 2026-01-15 00:00:00 +02:00 is 2026-01-14 22:00:00 UTC
      expect(window.start.toISOString()).toBe('2026-01-14T22:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-01-15T22:00:00.000Z')
      expect(window.resetAt.toISOString()).toBe('2026-01-15T22:00:00.000Z')
    })
  })

  describe('UTC', () => {
    it('calculates UTC policy day window correctly', () => {
      const now = new Date('2026-08-20T14:35:10.500Z')
      const window = resolvePolicyDayWindow(now, 'UTC')

      expect(window.start.toISOString()).toBe('2026-08-20T00:00:00.000Z')
      expect(window.end.toISOString()).toBe('2026-08-21T00:00:00.000Z')
      expect(window.resetAt.toISOString()).toBe('2026-08-21T00:00:00.000Z')
      expect(window.policyTimeZone).toBe('UTC')
    })
  })
})
