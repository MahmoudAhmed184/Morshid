export interface PolicyDayWindow {
  readonly start: Date
  readonly end: Date
  readonly resetAt: Date
  readonly policyTimeZone: string
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  let y = 0
  let m = 0
  let d = 0
  let h = 0
  let min = 0
  let s = 0
  let ms = 0
  for (const part of parts) {
    if (part.type === 'year') y = Number(part.value)
    if (part.type === 'month') m = Number(part.value)
    if (part.type === 'day') d = Number(part.value)
    if (part.type === 'hour') h = Number(part.value)
    if (part.type === 'minute') min = Number(part.value)
    if (part.type === 'second') s = Number(part.value)
    if (part.type === 'fractionalSecond') ms = Number(part.value)
  }
  const asUtc = Date.UTC(y, m - 1, d, h, min, s, ms)
  return asUtc - date.getTime()
}

export function getStartOfDayInTimeZone(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = formatter.formatToParts(date)
  let y = 0
  let m = 0
  let d = 0
  for (const part of parts) {
    if (part.type === 'year') y = Number(part.value)
    if (part.type === 'month') m = Number(part.value)
    if (part.type === 'day') d = Number(part.value)
  }
  const approxUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const offset = getTimeZoneOffsetMs(new Date(approxUtc), timeZone)
  let exact = approxUtc - offset
  const exactOffset = getTimeZoneOffsetMs(new Date(exact), timeZone)
  if (exactOffset !== offset) {
    exact = approxUtc - exactOffset
  }
  return new Date(exact)
}

export function resolvePolicyDayWindow(
  now: Date = new Date(),
  timeZone = 'Africa/Cairo',
): PolicyDayWindow {
  const start = getStartOfDayInTimeZone(now, timeZone)
  const tomorrowApprox = new Date(start.getTime() + 26 * 60 * 60 * 1000)
  const end = getStartOfDayInTimeZone(tomorrowApprox, timeZone)
  return {
    start,
    end,
    resetAt: end,
    policyTimeZone: timeZone,
  }
}
