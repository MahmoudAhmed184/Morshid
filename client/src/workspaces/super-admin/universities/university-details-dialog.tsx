import {
  BookOpen,
  Clock,
  CreditCard,
  Edit2,
  GraduationCap,
  History,
  Info,
  Landmark,
  Mail,
  Presentation,
  ShieldAlert,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { useUniversitySubscription } from '@/features/subscriptions/interface'
import type { UniversityItem } from '@/features/universities/universities.schema'

type UniversityDetailsDialogProps = {
  university: UniversityItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (university: UniversityItem) => void
  onChangeStatus?: (university: UniversityItem) => void
}

function formatDate(isoString?: string | null) {
  if (!isoString) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function UniversityDetailsDialog({
  university,
  open,
  onOpenChange,
  onEdit,
  onChangeStatus,
}: UniversityDetailsDialogProps) {
  const subscriptionQuery = useUniversitySubscription(
    open && university ? university.id : null,
  )

  if (!university) {
    return null
  }

  const sub = subscriptionQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold truncate">
                {university.name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 pt-0.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {university.code}
                </Badge>
                <StatusBadge status={university.status} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="general" className="text-xs sm:text-sm">
              <Info className="size-3.5 mr-1.5 hidden sm:inline-block" />
              General
            </TabsTrigger>
            <TabsTrigger value="manager" className="text-xs sm:text-sm">
              <User className="size-3.5 mr-1.5 hidden sm:inline-block" />
              Manager
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs sm:text-sm">
              <CreditCard className="size-3.5 mr-1.5 hidden sm:inline-block" />
              Plan & Pricing
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              <History className="size-3.5 mr-1.5 hidden sm:inline-block" />
              History
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: GENERAL INFO */}
          <TabsContent value="general" className="space-y-4 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tenancy Statistics
              </span>
              {onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onEdit(university)
                  }}
                >
                  <Edit2 className="size-3.5 mr-1.5" aria-hidden />
                  Edit Information
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <GraduationCap
                  className="size-5 text-primary mb-1"
                  aria-hidden
                />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.studentsCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Students
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <Presentation
                  className="size-5 text-primary mb-1"
                  aria-hidden
                />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.instructorsCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Instructors
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <BookOpen className="size-5 text-primary mb-1" aria-hidden />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.coursesCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Courses
                </span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Institution Identifiers
              </span>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">University Name</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {university.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Institution Code
                  </span>
                  <p className="font-mono font-medium text-foreground mt-0.5">
                    {university.code}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tenant Status</span>
                  <div className="mt-0.5">
                    <StatusBadge status={university.status} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: MANAGER (PRIMARY ADMINISTRATOR) */}
          <TabsContent value="manager" className="space-y-4 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Primary Administrator (Owner)
              </span>
              {university.owner ? (
                <Badge
                  variant={
                    university.owner.status === 'ACTIVE'
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="text-xs"
                >
                  {university.owner.status}
                </Badge>
              ) : null}
            </div>

            {university.owner ? (
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-base">
                      {university.owner.displayName}
                    </p>
                    <a
                      href={`mailto:${university.owner.email}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                    >
                      <Mail className="size-3" aria-hidden />
                      {university.owner.email}
                    </a>
                  </div>
                </div>

                <Separator />

                <div className="text-xs">
                  <div>
                    <span className="text-muted-foreground">Role</span>
                    <p className="font-medium text-foreground mt-0.5">
                      University Administrator
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                <ShieldAlert className="size-8 text-muted-foreground/60 mb-2" />
                <p className="font-medium text-foreground">
                  No Primary Owner Assigned
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  This university tenant does not have a primary administrator
                  assigned yet.
                </p>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: CURRENT PLAN & PRICING */}
          <TabsContent value="pricing" className="space-y-4 pt-3 text-sm">
            {subscriptionQuery.isLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-16 w-full" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ) : sub ? (
              <div className="space-y-4">
                {/* Plan banner */}
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" />
                      <span className="font-semibold text-foreground">
                        Institutional Subscription Plan
                      </span>
                    </div>
                    <Badge
                      variant={
                        sub.subscriptionStatus === 'ACTIVE'
                          ? 'secondary'
                          : sub.subscriptionStatus === 'PENDING_CANCELLATION'
                            ? 'outline'
                            : 'destructive'
                      }
                      className="text-xs font-semibold"
                    >
                      {sub.subscriptionStatus === 'ACTIVE'
                        ? 'Active Plan'
                        : sub.subscriptionStatus === 'PENDING_CANCELLATION'
                          ? 'Pending Cancellation'
                          : 'Cancelled'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-md border bg-muted/30 p-3 text-center">
                      <span className="text-[0.7rem] text-muted-foreground uppercase font-medium">
                        Rate per Seat
                      </span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {formatCurrency(
                          sub.effectivePricePerSeat,
                          sub.currency,
                        )}
                      </p>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {sub.isCustomPrice
                          ? 'Custom override'
                          : 'Standard rate'}
                      </span>
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3 text-center">
                      <span className="text-[0.7rem] text-muted-foreground uppercase font-medium">
                        Peak Students
                      </span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {sub.peakStudentsCount}
                      </p>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {sub.currentStudentsCount} active right now
                      </span>
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3 text-center">
                      <span className="text-[0.7rem] text-muted-foreground uppercase font-medium">
                        Est. Monthly Total
                      </span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {formatCurrency(
                          sub.estimatedMonthlyTotal,
                          sub.currency,
                        )}
                      </p>
                      <span className="text-[0.65rem] text-muted-foreground">
                        Current cycle cost
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing cycle & schedule details */}
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-xs">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[0.7rem]">
                    Billing Cycle Details
                  </span>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-muted-foreground">
                        Billing Period:
                      </span>
                      <p className="font-medium text-foreground mt-0.5">
                        {formatDate(sub.billingPeriodStart)} –{' '}
                        {formatDate(sub.billingPeriodEnd)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Next Billing Date:
                      </span>
                      <p className="font-medium text-foreground mt-0.5">
                        {formatDate(sub.nextBillingDate)}
                      </p>
                    </div>
                  </div>

                  {sub.hasNextPriceChange &&
                  sub.nextEffectivePricePerSeat !== null &&
                  sub.nextEffectivePricePerSeat !== undefined ? (
                    <div className="mt-3 rounded-md bg-blue-500/10 border border-blue-500/30 p-2.5 text-blue-900 dark:text-blue-200">
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <Clock className="size-3.5" />
                        Upcoming Scheduled Price Change
                      </div>
                      <p className="text-[0.7rem] mt-0.5 opacity-90">
                        Effective next cycle, the rate will adjust to{' '}
                        <strong>
                          {formatCurrency(
                            sub.nextEffectivePricePerSeat,
                            sub.currency,
                          )}
                          /seat
                        </strong>
                        .
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                <CreditCard className="size-6 text-muted-foreground/60 mb-1.5" />
                <p className="font-medium text-foreground">
                  Standard Billing Applies
                </p>
                <p className="mt-0.5">
                  Estimated seats: {university.studentsCount} active students.
                </p>
              </div>
            )}
          </TabsContent>

          {/* TAB 4: HISTORY */}
          <TabsContent value="history" className="space-y-4 pt-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Institution Activity & Milestones
            </span>

            <div className="relative border-l border-border pl-4 space-y-4 ml-2">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-foreground text-xs">
                    University Provisioned
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {formatDate(university.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Institution tenant created with initial administrator
                    profile and assigned code {university.code}.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-muted-foreground/40" />
                <div>
                  <p className="font-medium text-foreground text-xs">
                    Profile & Tenancy Updates
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {formatDate(university.updatedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Latest tenant configuration and metadata record
                    synchronization.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-muted-foreground/40" />
                <div>
                  <p className="font-medium text-foreground text-xs">
                    Current Tenancy Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={university.status} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:justify-between pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {onChangeStatus ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onChangeStatus(university)
                }}
              >
                <ShieldAlert className="size-3.5 mr-1.5" aria-hidden />
                Change Status
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
