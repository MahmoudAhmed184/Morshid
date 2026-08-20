import {
  formatBillingPeriodKey,
  getAnniversaryDate,
  getDaysInUTCMonth,
  getInvoiceGracePeriodEnd,
  getInvoicePaymentState,
  getSubscriptionBillingPeriod,
} from './subscriptions.dates'

describe('subscriptions.dates', () => {
  describe('getDaysInUTCMonth', () => {
    it('returns correct days for standard months', () => {
      expect(getDaysInUTCMonth(2026, 0)).toBe(31) // Jan
      expect(getDaysInUTCMonth(2026, 1)).toBe(28) // Feb (non-leap)
      expect(getDaysInUTCMonth(2028, 1)).toBe(29) // Feb (leap year)
      expect(getDaysInUTCMonth(2026, 3)).toBe(30) // Apr
      expect(getDaysInUTCMonth(2026, 7)).toBe(31) // Aug
    })
  })

  describe('getAnniversaryDate', () => {
    it('calculates monthly increments preserving anchor day', () => {
      const anchor = new Date('2026-08-20T00:00:00.000Z')

      const month0 = getAnniversaryDate(anchor, 0)
      const month1 = getAnniversaryDate(anchor, 1)
      const month2 = getAnniversaryDate(anchor, 2)
      const month12 = getAnniversaryDate(anchor, 12)

      expect(month0.toISOString()).toBe('2026-08-20T00:00:00.000Z')
      expect(month1.toISOString()).toBe('2026-09-20T00:00:00.000Z')
      expect(month2.toISOString()).toBe('2026-10-20T00:00:00.000Z')
      expect(month12.toISOString()).toBe('2027-08-20T00:00:00.000Z')
    })

    it('clamps to end of month for shorter months and restores anchor day for longer months', () => {
      const anchor = new Date('2026-01-31T00:00:00.000Z')

      const jan = getAnniversaryDate(anchor, 0)
      const feb = getAnniversaryDate(anchor, 1) // Feb 28 in 2026
      const mar = getAnniversaryDate(anchor, 2) // Mar 31
      const apr = getAnniversaryDate(anchor, 3) // Apr 30
      const may = getAnniversaryDate(anchor, 4) // May 31

      expect(jan.toISOString()).toBe('2026-01-31T00:00:00.000Z')
      expect(feb.toISOString()).toBe('2026-02-28T00:00:00.000Z')
      expect(mar.toISOString()).toBe('2026-03-31T00:00:00.000Z')
      expect(apr.toISOString()).toBe('2026-04-30T00:00:00.000Z')
      expect(may.toISOString()).toBe('2026-05-31T00:00:00.000Z')
    })
  })

  describe('formatBillingPeriodKey', () => {
    it('formats date range as YYYY-MM-DD_YYYY-MM-DD', () => {
      const start = new Date('2026-08-20T00:00:00.000Z')
      const end = new Date('2026-09-20T00:00:00.000Z')
      expect(formatBillingPeriodKey(start, end)).toBe('2026-08-20_2026-09-20')
    })
  })

  describe('getSubscriptionBillingPeriod', () => {
    it('computes cycle starting on August 20, 2026', () => {
      const startDate = new Date('2026-08-20T00:00:00.000Z')
      const now = new Date('2026-08-25T12:00:00.000Z')

      const period = getSubscriptionBillingPeriod(startDate, now)

      expect(period.start.toISOString()).toBe('2026-08-20T00:00:00.000Z')
      expect(period.end.toISOString()).toBe('2026-09-20T00:00:00.000Z')
      expect(period.nextBillingDate.toISOString()).toBe(
        '2026-09-20T00:00:00.000Z',
      )
      expect(period.period).toBe('2026-08-20_2026-09-20')
      expect(period.gracePeriodEnd.toISOString()).toBe(
        '2026-09-27T00:00:00.000Z',
      )
    })

    it('advances to next cycle when current date exceeds period end', () => {
      const startDate = new Date('2026-08-20T00:00:00.000Z')
      const now = new Date('2026-09-21T00:00:00.000Z')

      const period = getSubscriptionBillingPeriod(startDate, now)

      expect(period.start.toISOString()).toBe('2026-09-20T00:00:00.000Z')
      expect(period.end.toISOString()).toBe('2026-10-20T00:00:00.000Z')
      expect(period.period).toBe('2026-09-20_2026-10-20')
    })
  })

  describe('invoice grace period', () => {
    const periodEnd = new Date('2026-09-20T00:00:00.000Z')

    it('keeps an unpaid invoice in grace for exactly seven days', () => {
      const graceEnd = getInvoiceGracePeriodEnd(periodEnd)

      expect(graceEnd.toISOString()).toBe('2026-09-27T00:00:00.000Z')
      expect(
        getInvoicePaymentState(graceEnd, new Date('2026-09-26T23:59:59.999Z')),
      ).toEqual({ isInGracePeriod: true, isOverdue: false })
    })

    it('marks the invoice overdue at the grace deadline', () => {
      const graceEnd = getInvoiceGracePeriodEnd(periodEnd)

      expect(getInvoicePaymentState(graceEnd, graceEnd)).toEqual({
        isInGracePeriod: false,
        isOverdue: true,
      })
    })

    it('does not warn when there is no unpaid invoice', () => {
      expect(getInvoicePaymentState(null, periodEnd)).toEqual({
        isInGracePeriod: false,
        isOverdue: false,
      })
    })
  })
})
