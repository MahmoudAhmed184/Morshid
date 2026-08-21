import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  Info,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ErrorState } from '@/components/ui/custom/error-state/error-state'
import { PageHeader } from '@/components/ui/custom/page-header/page-header'
import { StatCard } from '@/components/ui/custom/stat-card/stat-card'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMySubscription,
  useResumeMySubscriptionMutation,
} from '@/features/subscriptions/interface'
import type { UniversitySubscriptionItem } from '@/features/subscriptions/interface'
import { CancelSubscriptionDialog } from './cancel-subscription-dialog'

function formatDate(isoString?: string | null) {
  if (isoString === undefined || isoString === null || isoString === '') {
    return '—'
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function getStatusBadgeVariant(
  status: UniversitySubscriptionItem['subscriptionStatus'],
): 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PENDING_CANCELLATION':
      return 'warning'
    case 'CANCELLED':
      return 'destructive'
  }
}

function getStatusLabel(
  status: UniversitySubscriptionItem['subscriptionStatus'],
) {
  switch (status) {
    case 'ACTIVE':
      return 'Active'
    case 'PENDING_CANCELLATION':
      return 'Pending Cancellation'
    case 'CANCELLED':
      return 'Cancelled'
  }
}

export function AdminSubscriptionsPage() {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const subscriptionQuery = useMySubscription()
  const resumeMutation = useResumeMySubscriptionMutation()

  const sub = subscriptionQuery.data

  const handleResume = async () => {
    try {
      await resumeMutation.mutateAsync()
    } catch {
      // handled by react-query
    }
  }

  if (subscriptionQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your university's subscription, seat pricing, and monthly billing."
        />
        <ErrorState
          title="Failed to load subscription details"
          description={
            subscriptionQuery.error.message ||
            'Could not retrieve your university subscription information.'
          }
          onRetry={() => void subscriptionQuery.refetch()}
        />
      </div>
    )
  }

  if (subscriptionQuery.isLoading || !sub) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your university's subscription, seat pricing, and monthly billing."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const isPendingCancel = sub.subscriptionStatus === 'PENDING_CANCELLATION'
  const isCancelled = sub.subscriptionStatus === 'CANCELLED'
  const isSuspended =
    sub.universityStatus === 'SUSPENDED' || sub.isOverdue === true
  const isInGracePeriod = sub.isInGracePeriod === true
  const peakDifference = sub.peakStudentsCount - sub.currentStudentsCount
  const hasUpcomingPriceAdjustment =
    sub.hasNextPriceChange && typeof sub.nextEffectivePricePerSeat === 'number'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription & Billing"
        description={`Manage the institutional plan and seat capacity for ${sub.universityName}.`}
      />

      {/* University Suspended Banner */}
      {isSuspended ? (
        <Alert variant="destructive">
          <ShieldAlert className="size-5 shrink-0" />
          <div className="space-y-1">
            <AlertTitle className="font-semibold">
              University Access Suspended
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              Your university subscription is past due beyond the 7-day grace
              period. Access for administrators, instructors, and students is
              suspended. All course materials and student progress remain safely
              preserved. Please settle your outstanding invoice to restore full
              access.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      {/* 7-Day Payment Grace Period Active Banner */}
      {isInGracePeriod && !isSuspended ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="space-y-1">
            <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
              Invoice Payment Due &ndash; 7-Day Grace Period Active
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Your billing period has completed and your monthly invoice is due.
              Your institution remains accessible during the 7-day grace period
              ending on{' '}
              <strong className="font-semibold">
                {formatDate(sub.gracePeriodEnd ?? sub.nextBillingDate)}
              </strong>
              . Please submit payment before this date to prevent automatic
              account suspension.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      {/* Upcoming Price Change Notification Banner */}
      {hasUpcomingPriceAdjustment &&
      typeof sub.nextEffectivePricePerSeat === 'number' ? (
        <Alert className="border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200">
          <Bell className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTitle className="text-blue-950 dark:text-blue-100 font-semibold mb-0">
                Notice: Upcoming Seat Rate Adjustment
              </AlertTitle>
              <Badge
                variant="default"
                className="text-xs bg-blue-600 dark:bg-blue-500"
              >
                Effective{' '}
                {formatDate(sub.nextPriceEffectiveDate ?? sub.nextBillingDate)}
              </Badge>
            </div>
            <AlertDescription className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
              Your price per student seat will adjust from{' '}
              <strong className="font-semibold">
                ${sub.effectivePricePerSeat.toFixed(2)}/seat
              </strong>{' '}
              to{' '}
              <strong className="font-semibold text-blue-950 dark:text-white">
                ${sub.nextEffectivePricePerSeat.toFixed(2)}/seat
              </strong>{' '}
              starting next cycle (
              {formatDate(sub.nextPriceEffectiveDate ?? sub.nextBillingDate)}).
              Your current billing cycle invoice remains at the active rate of $
              {sub.effectivePricePerSeat.toFixed(2)}/seat.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      {/* Pending Cancellation Banner */}
      {isPendingCancel ? (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-5 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
            <div>
              <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
                Subscription scheduled for cancellation
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                Your subscription remains fully active until the end of your
                billing cycle on{' '}
                <strong className="font-semibold">
                  {formatDate(sub.nextBillingDate)}
                </strong>
                . When the cycle ends, your subscription will be cancelled and
                the university marked Inactive. You can resume at any time
                before this date.
              </AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0 border-amber-500/40 bg-background text-foreground hover:bg-amber-500/10"
              disabled={resumeMutation.isPending}
              onClick={() => void handleResume()}
            >
              <RotateCcw className="size-3.5" />
              {resumeMutation.isPending ? 'Resuming...' : 'Resume Subscription'}
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* High-Water Mark Peak Billing Policy Banner */}
      <Alert className="border-primary/20 bg-primary/5 text-foreground">
        <Info className="size-5 text-primary shrink-0" />
        <div className="space-y-1">
          <AlertTitle className="font-semibold text-foreground">
            Anniversary Monthly Peak (High-Water Mark) Billing Model
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
            Your university is billed on an anniversary monthly cycle (
            {formatDate(sub.billingPeriodStart)} &ndash;{' '}
            {formatDate(sub.billingPeriodEnd)}). Billing reflects the{' '}
            <strong className="font-semibold text-foreground">
              maximum number of active student seats
            </strong>{' '}
            registered at any point during this billing cycle. If students are
            deleted or deactivated before the cycle ends, your invoice still
            reflects the peak seat count for this period.
          </AlertDescription>
        </div>
      </Alert>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CreditCard />}
          tone={isPendingCancel || isSuspended ? 'warning' : 'success'}
          label="Subscription Status"
          value={
            isSuspended ? 'Suspended' : getStatusLabel(sub.subscriptionStatus)
          }
          description={
            isPendingCancel
              ? `Access ends ${formatDate(sub.nextBillingDate)}`
              : isSuspended
                ? 'Payment overdue past 7-day grace period'
                : isInGracePeriod
                  ? `Grace period ends ${formatDate(sub.gracePeriodEnd)}`
                  : 'Institutional active license'
          }
        />
        <StatCard
          icon={<Coins />}
          tone="default"
          label="Current Seat Rate"
          value={`$${sub.effectivePricePerSeat.toFixed(2)}`}
          description={
            hasUpcomingPriceAdjustment &&
            typeof sub.nextEffectivePricePerSeat === 'number'
              ? `Next cycle: $${sub.nextEffectivePricePerSeat.toFixed(2)} / seat`
              : sub.isCustomPrice
                ? 'Custom institutional rate'
                : 'Standard global rate'
          }
        />
        <StatCard
          icon={<Users />}
          tone="info"
          label="Current Active Students"
          value={sub.currentStudentsCount}
          description="Currently registered active accounts"
        />
        <StatCard
          icon={<TrendingUp />}
          tone="warning"
          label="Peak Seats (This Cycle)"
          value={sub.peakStudentsCount}
          description="Highest active student count this cycle"
        />
      </div>

      {/* Main Billing Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">Billing Cycle & Usage</CardTitle>
                <CardDescription>
                  Current billing period: {formatDate(sub.billingPeriodStart)}{' '}
                  &ndash; {formatDate(sub.billingPeriodEnd)}
                </CardDescription>
              </div>
              <StatusBadge
                status={getStatusBadgeVariant(sub.subscriptionStatus)}
                label={getStatusLabel(sub.subscriptionStatus)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">University</span>
                <span className="font-semibold text-foreground">
                  {sub.universityName} ({sub.universityCode})
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Current Pricing Rate
                </span>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <span>
                    ${sub.effectivePricePerSeat.toFixed(2)} / seat / month
                  </span>
                  {sub.isCustomPrice ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-primary/10 text-primary font-medium"
                    >
                      Custom
                    </Badge>
                  ) : null}
                </div>
              </div>
              {hasUpcomingPriceAdjustment &&
              typeof sub.nextEffectivePricePerSeat === 'number' ? (
                <div className="flex items-center justify-between text-sm rounded-lg bg-blue-500/10 p-2 border border-blue-500/20">
                  <span className="font-medium text-blue-950 dark:text-blue-200">
                    Next Cycle Rate (
                    {formatDate(
                      sub.nextPriceEffectiveDate ?? sub.nextBillingDate,
                    )}
                    )
                  </span>
                  <Badge
                    variant="default"
                    className="bg-blue-600 dark:bg-blue-500"
                  >
                    ${sub.nextEffectivePricePerSeat.toFixed(2)} / seat
                  </Badge>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Current Active Students
                </span>
                <span className="font-medium text-foreground">
                  {sub.currentStudentsCount} seats
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    Peak Students (Billed)
                  </span>
                  <TrendingUp className="size-3.5 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">
                    {sub.peakStudentsCount} seats
                  </span>
                  {peakDifference > 0 ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono"
                    >
                      {sub.currentStudentsCount} current ({peakDifference}{' '}
                      deleted/disabled)
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-base font-semibold text-foreground">
                  Estimated Monthly Invoice
                </span>
                <div className="flex items-baseline gap-1 text-xl font-extrabold text-foreground">
                  <DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span>{sub.estimatedMonthlyTotal.toFixed(2)}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {sub.currency}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  Next invoice date:{' '}
                  <strong className="font-medium text-foreground">
                    {formatDate(sub.nextBillingDate)}
                  </strong>
                </span>
              </p>
              {sub.gracePeriodEnd ? (
                <p className="text-[11px] text-muted-foreground">
                  7-day payment grace period extends to{' '}
                  <strong className="font-medium text-foreground">
                    {formatDate(sub.gracePeriodEnd)}
                  </strong>
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 pt-4">
            <div className="text-xs text-muted-foreground">
              {isPendingCancel
                ? 'Cancellation is scheduled for the end of the billing period.'
                : 'Need to make changes to your plan or cancel subscription?'}
            </div>
            {isPendingCancel ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={resumeMutation.isPending}
                onClick={() => void handleResume()}
              >
                <RotateCcw className="size-3.5" />
                {resumeMutation.isPending
                  ? 'Resuming...'
                  : 'Resume Subscription'}
              </Button>
            ) : !isCancelled ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel Subscription
              </Button>
            ) : null}
          </CardFooter>
        </Card>

        {/* Informational Guidance Card */}
        <Card className="border shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Seat Management Guide</CardTitle>
            <CardDescription>
              How seats, anniversary cycles, and peak billing work for your
              institution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground">
                  Anniversary monthly cycle:
                </strong>{' '}
                Your billing period starts on your activation date and runs for
                one calendar month.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground">
                  High-water mark billing:
                </strong>{' '}
                You are billed for the maximum seats active during the billing
                cycle.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground">
                  Period-end cancellation:
                </strong>{' '}
                Canceling stops renewal at the end of the current period with no
                immediate service cut. At period end, university status becomes
                Inactive.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong className="font-semibold text-foreground">
                  7-Day grace period:
                </strong>{' '}
                Invoices have a 7-day payment window before access is suspended.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <CancelSubscriptionDialog
        subscription={sub}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
      />
    </div>
  )
}
