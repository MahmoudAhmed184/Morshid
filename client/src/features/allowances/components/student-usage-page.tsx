import { useState, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  studentTutoringAllowanceQueryOptions,
  studentReviewAllowanceQueryOptions,
} from '../allowances.queries'

function formatResetTime(isoDate: string, timeZone: string): string {
  try {
    const date = new Date(isoDate)
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: '2-digit',
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
  const courses = coursesQuery.data ?? []

  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const activeCourseId = selectedCourseId || courses[0]?.id || ''

  const tutoringQuery = useQuery(
    studentTutoringAllowanceQueryOptions(activeCourseId),
  )
  const reviewQuery = useQuery(
    studentReviewAllowanceQueryOptions(activeCourseId),
  )

  const activeCourse = courses.find((c) => c.id === activeCourseId)

  if (coursesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Enrolled Courses</CardTitle>
          <CardDescription>
            You are not currently enrolled in any courses with active
            allowances.
          </CardDescription>
        </CardHeader>
      </Card>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Daily Allowances
          </h2>
          <p className="text-sm text-muted-foreground">
            Allowances reset daily at midnight in the policy timezone.
          </p>
        </div>

        {courses.length > 1 && (
          <div className="w-full sm:w-64">
            <label htmlFor={courseSelectId} className="sr-only">
              Select course
            </label>
            <Select
              value={activeCourseId}
              onValueChange={(value) => setSelectedCourseId(value ?? '')}
            >
              <SelectTrigger id={courseSelectId} aria-label="Select course">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} — {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {activeCourse && (
        <div className="text-sm font-medium text-muted-foreground">
          Viewing allowances for{' '}
          <span className="text-foreground">
            {activeCourse.code}: {activeCourse.title}
          </span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tutoring Allowance Card */}
        <Card data-testid="tutoring-allowance-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Tutoring Allowance
              </CardTitle>
              <CardDescription>Daily Socratic turns</CardDescription>
            </div>
            {tutoring && (
              <Badge
                variant={
                  tutoring.remaining === 0
                    ? 'destructive'
                    : tutoring.remaining <= 3
                      ? 'outline'
                      : 'secondary'
                }
              >
                {tutoring.remaining === 0
                  ? 'Exhausted'
                  : `${tutoring.remaining} remaining`}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {tutoringQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : tutoring ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold">
                    {tutoring.used}
                    <span className="text-lg font-normal text-muted-foreground">
                      {' '}
                      / {tutoring.limit}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {tutoringPercent}% used
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all ${
                      tutoring.remaining === 0
                        ? 'bg-destructive'
                        : tutoring.remaining <= 3
                          ? 'bg-amber-500'
                          : 'bg-primary'
                    }`}
                    style={{ width: `${tutoringPercent}%` }}
                  />
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Resets:{' '}
                    <span className="font-medium text-foreground">
                      {formatResetTime(
                        tutoring.policyDayWindow.end,
                        tutoring.policyDayWindow.timeZone,
                      )}
                    </span>{' '}
                    ({tutoring.policyDayWindow.timeZone})
                  </p>
                  <p>
                    Replays, failovers, and product retries do not count towards
                    your limit.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load tutoring allowance.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Review Allowance Card */}
        <Card data-testid="review-allowance-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Review Allowance
              </CardTitle>
              <CardDescription>
                Daily manual instructor-review requests
              </CardDescription>
            </div>
            {review && (
              <Badge
                variant={review.remaining === 0 ? 'destructive' : 'secondary'}
              >
                {review.remaining === 0
                  ? 'Exhausted'
                  : `${review.remaining} remaining`}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {reviewQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : review ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-bold">
                    {review.used}
                    <span className="text-lg font-normal text-muted-foreground">
                      {' '}
                      / {review.limit}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {reviewPercent}% used
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all ${
                      review.remaining === 0 ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${reviewPercent}%` }}
                  />
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Resets:{' '}
                    <span className="font-medium text-foreground">
                      {formatResetTime(
                        review.policyDayWindow.end,
                        review.policyDayWindow.timeZone,
                      )}
                    </span>{' '}
                    ({review.policyDayWindow.timeZone})
                  </p>
                  <p>Automatic review triggers never consume your allowance.</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load review allowance.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
