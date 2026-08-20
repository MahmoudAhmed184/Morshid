export interface UniversityBillingPeriod {
  period: string
  start: Date
  end: Date
  nextBillingDate: Date
  gracePeriodEnd: Date
}

export interface InvoicePaymentState {
  isInGracePeriod: boolean
  isOverdue: boolean
}

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export function getInvoiceGracePeriodEnd(periodEnd: Date): Date {
  return new Date(periodEnd.getTime() + GRACE_PERIOD_MS)
}

export function getInvoicePaymentState(
  gracePeriodEnd: Date | null,
  now = new Date(),
): InvoicePaymentState {
  return {
    isInGracePeriod: gracePeriodEnd !== null && now < gracePeriodEnd,
    isOverdue: gracePeriodEnd !== null && now >= gracePeriodEnd,
  }
}

/**
 * Returns the number of days in the specified UTC month of a UTC year.
 * @param year - 4-digit UTC year (e.g. 2026)
 * @param month - 0-indexed UTC month (0 = Jan, 1 = Feb, ..., 11 = Dec)
 */
export function getDaysInUTCMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Calculates the exact anniversary date N months from a subscription's anchor activation date.
 * Preserves the day of month, clamping to the month's maximum days if needed (e.g. Jan 31 -> Feb 28 -> Mar 31).
 */
export function getAnniversaryDate(
  anchorDate: Date,
  monthsToAdd: number,
): Date {
  const anchorYear = anchorDate.getUTCFullYear()
  const anchorMonth = anchorDate.getUTCMonth()
  const anchorDay = anchorDate.getUTCDate()
  const hours = anchorDate.getUTCHours()
  const minutes = anchorDate.getUTCMinutes()
  const seconds = anchorDate.getUTCSeconds()
  const ms = anchorDate.getUTCMilliseconds()

  const targetTotalMonths = anchorYear * 12 + anchorMonth + monthsToAdd
  const targetYear = Math.floor(targetTotalMonths / 12)
  const targetMonth = targetTotalMonths % 12

  const maxDays = getDaysInUTCMonth(targetYear, targetMonth)
  const targetDay = Math.min(anchorDay, maxDays)

  return new Date(
    Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms),
  )
}

/**
 * Computes a standard billing period key string from start and end dates.
 * Format: "YYYY-MM-DD_YYYY-MM-DD"
 */
export function formatBillingPeriodKey(start: Date, end: Date): string {
  const sYear = start.getUTCFullYear().toString()
  const sMonth = (start.getUTCMonth() + 1).toString().padStart(2, '0')
  const sDay = start.getUTCDate().toString().padStart(2, '0')

  const eYear = end.getUTCFullYear().toString()
  const eMonth = (end.getUTCMonth() + 1).toString().padStart(2, '0')
  const eDay = end.getUTCDate().toString().padStart(2, '0')

  return `${sYear}-${sMonth}-${sDay}_${eYear}-${eMonth}-${eDay}`
}

/**
 * Calculates the current anniversary billing period for a university subscription given its start date.
 *
 * @param startDate - The initial subscription activation date
 * @param now - Current reference date (defaults to new Date())
 */
export function getSubscriptionBillingPeriod(
  startDate: Date,
  now = new Date(),
): UniversityBillingPeriod {
  const diffMonths =
    (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - startDate.getUTCMonth())

  let k = Math.max(0, diffMonths - 1)

  while (getAnniversaryDate(startDate, k + 1) <= now) {
    k++
  }

  while (k > 0 && getAnniversaryDate(startDate, k) > now) {
    k--
  }

  const start = getAnniversaryDate(startDate, k)
  const end = getAnniversaryDate(startDate, k + 1)
  const period = formatBillingPeriodKey(start, end)
  const nextBillingDate = end

  // 7-day grace period from period end
  const gracePeriodEnd = getInvoiceGracePeriodEnd(end)

  return {
    period,
    start,
    end,
    nextBillingDate,
    gracePeriodEnd,
  }
}
