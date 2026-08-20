import { useState, useId, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  Info,
  RotateCw,
  Sparkles,
  UserCheck,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { studentCourseAccessQueryOptions } from '@/features/courses/interface'
import { cn } from '@/lib/utils'
import {
  studentTutoringAllowanceQueryOptions,
  studentReviewAllowanceQueryOptions,
} from '../allowances.queries'

function formatResetTime(isoDate: string, timeZone: string): string {
  try {
    const date = new Date(isoDate)
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch {
    return isoDate
  }
}

export function StudentUsagePage() {
  const user = useAuthStore((state) => state.user)
  const studentId = user?.id ?? ''
  const courseSelectId = useId()

  const coursesQuery = useQuery(studentCourseAccessQueryOptions(studentId))
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data])

  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const activeCourseId = selectedCourseId || courses[0]?.id || ''

  const tutoringQuery = useQuery(
    studentTutoringAllowanceQueryOptions(activeCourseId),
  )
  const reviewQuery = useQuery(
    studentReviewAllowanceQueryOptions(activeCourseId),
  )

  const activeCourse = courses.find((c) => c.id === activeCourseId)

  const courseSelectItems = useMemo(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })),
    [courses],
  )

  if (coursesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
          <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (coursesQuery.isError) {
    return (
      <div className="space-y-4">
        <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
          <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-medium text-foreground">
                Usage & Allowances
              </h2>
            </div>
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Failed to load course information.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void coursesQuery.refetch()}
                  className="h-7 text-xs"
                >
                  <RotateCw className="mr-1.5 size-3" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
          <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-medium text-foreground">
                Usage & Allowances
              </h2>
            </div>
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                You are not currently enrolled in any courses with active
                allowances.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tutoring = tutoringQuery.data
  const review = reviewQuery.data

  const tutoringPercent = tutoring
    ? Math.min(
        100,
        Math.round((tutoring.used / Math.max(1, tutoring.limit)) * 100),
      )
    : 0

  const reviewPercent = review
    ? Math.min(100, Math.round((review.used / Math.max(1, review.limit)) * 100))
    : 0

  const resetTimeStr = tutoring?.resetAt
    ? formatResetTime(tutoring.resetAt, tutoring.policyTimeZone)
    : review?.resetAt
      ? formatResetTime(review.resetAt, review.policyTimeZone)
      : null

  const timeZoneStr =
    tutoring?.policyTimeZone ?? review?.policyTimeZone ?? 'Africa/Cairo'

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          {/* Header row with course selector */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-medium text-foreground">
                Usage & Allowances
              </h2>
            </div>

            {courses.length > 1 ? (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={courseSelectId}
                  className="text-xs text-muted-foreground whitespace-nowrap"
                >
                  Course:
                </Label>
                <Select
                  value={activeCourseId}
                  items={courseSelectItems}
                  onValueChange={(value) => {
                    if (value) setSelectedCourseId(value)
                  }}
                >
                  <SelectTrigger
                    id={courseSelectId}
                    size="sm"
                    className="w-[200px] sm:w-[260px]"
                    aria-label="Select course"
                  >
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courseSelectItems.map((course) => (
                      <SelectItem key={course.value} value={course.value}>
                        {course.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : activeCourse ? (
              <Badge
                variant="secondary"
                className="self-start sm:self-auto font-normal text-xs"
              >
                {activeCourse.code}: {activeCourse.title}
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <p className="leading-relaxed">
                Daily interaction allowances allocated for your enrolled
                courses. Quotas automatically refresh each Policy Day at
                midnight ({timeZoneStr}).
              </p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tutoring Allowance Card */}
            <div
              data-testid="tutoring-allowance-card"
              className={cn(
                'group relative flex flex-col justify-between gap-4 rounded-xl border bg-background/60 p-4.5 transition-all',
                tutoring?.remaining === 0
                  ? 'border-destructive/40 bg-destructive/5'
                  : tutoring && tutoring.remaining <= 3
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border/80 hover:border-border',
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="size-4" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Tutoring Allowance
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Daily Socratic turns
                      </p>
                    </div>
                  </div>

                  {tutoring ? (
                    <Badge
                      variant={
                        tutoring.remaining === 0
                          ? 'destructive'
                          : tutoring.remaining <= 3
                            ? 'outline'
                            : 'secondary'
                      }
                      className={cn(
                        'text-xs font-medium',
                        tutoring.remaining <= 3 &&
                          tutoring.remaining > 0 &&
                          'border-amber-500/50 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {tutoring.remaining === 0
                        ? 'Exhausted'
                        : `${tutoring.remaining} remaining`}
                    </Badge>
                  ) : null}
                </div>

                {tutoringQuery.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : tutoringQuery.isError ? (
                  <div className="flex items-center justify-between rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                    <span>Unable to load tutoring allowance.</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => void tutoringQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : tutoring ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold tracking-tight text-foreground">
                        {tutoring.used}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}
                          / {tutoring.limit} used
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {tutoringPercent}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          tutoring.remaining === 0
                            ? 'bg-destructive'
                            : tutoring.remaining <= 3
                              ? 'bg-amber-500'
                              : 'bg-primary',
                        )}
                        style={{ width: `${tutoringPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border/40 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Sparkles className="size-3 text-primary" aria-hidden />
                  Idempotent safe:
                </span>{' '}
                Retries, replays, and failovers do not consume quota.
              </div>
            </div>

            {/* Review Allowance Card */}
            <div
              data-testid="review-allowance-card"
              className={cn(
                'group relative flex flex-col justify-between gap-4 rounded-xl border bg-background/60 p-4.5 transition-all',
                review?.remaining === 0
                  ? 'border-destructive/40 bg-destructive/5'
                  : review && review.remaining <= 1
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border/80 hover:border-border',
              )}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <UserCheck className="size-4" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Review Allowance
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Daily instructor reviews
                      </p>
                    </div>
                  </div>

                  {review ? (
                    <Badge
                      variant={
                        review.remaining === 0
                          ? 'destructive'
                          : review.remaining <= 1
                            ? 'outline'
                            : 'secondary'
                      }
                      className={cn(
                        'text-xs font-medium',
                        review.remaining <= 1 &&
                          review.remaining > 0 &&
                          'border-amber-500/50 text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {review.remaining === 0
                        ? 'Exhausted'
                        : `${review.remaining} remaining`}
                    </Badge>
                  ) : null}
                </div>

                {reviewQuery.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : reviewQuery.isError ? (
                  <div className="flex items-center justify-between rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                    <span>Unable to load review allowance.</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => void reviewQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : review ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold tracking-tight text-foreground">
                        {review.used}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}
                          / {review.limit} used
                        </span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {reviewPercent}%
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          review.remaining === 0
                            ? 'bg-destructive'
                            : review.remaining <= 1
                              ? 'bg-amber-500'
                              : 'bg-primary',
                        )}
                        style={{ width: `${reviewPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border/40 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <CheckCircle2
                    className="size-3 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  Instructor bounded:
                </span>{' '}
                Automatic system reviews never consume your allowance.
              </div>
            </div>
          </div>

          {/* Reset schedule footer info */}
          {resetTimeStr ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                Next allowance reset:{' '}
                <span className="font-normal text-muted-foreground">
                  {resetTimeStr}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Policy Timezone:{' '}
                <strong className="font-medium text-foreground">
                  {timeZoneStr}
                </strong>
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
