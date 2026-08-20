import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Edit2,
  Info,
  Landmark,
  Mail,
  ReceiptText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { ErrorState } from '@/components/ui/custom/error-state/error-state'
import { NumberedPagination } from '@/components/ui/custom/pagination/numbered-pagination'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useUniversityInvoices,
  useUniversitySubscription,
} from '@/features/subscriptions/interface'
import type { UniversityStatus } from '@/features/universities/universities.schema'
import { EditCustomPriceDialog } from '@/workspaces/super-admin/subscriptions/edit-custom-price-dialog'
import { EditUniversityDialog } from './edit-university-dialog'
import { useUniversityDetail, useUniversityMutations } from './use-universities'

type UniversityDetailPageProps = {
  universityId: string
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

function formatPeriodDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(isoString),
  )
}

function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${lastDay.toString().padStart(2, '0')}`
}

export function UniversityDetailPage({
  universityId,
}: UniversityDetailPageProps) {
  const [copiedEmail, setCopiedEmail] = useState(false)

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editSection, setEditSection] = useState<'university' | 'manager'>(
    'university',
  )
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [invoicePage, setInvoicePage] = useState(1)
  const [invoiceFromMonth, setInvoiceFromMonth] = useState('')
  const [invoiceToMonth, setInvoiceToMonth] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState<
    'ALL' | 'PAID' | 'DUE' | 'OVERDUE'
  >('ALL')
  const [invoiceSort, setInvoiceSort] = useState<
    'newest' | 'oldest' | 'highest' | 'lowest' | 'peakSeats'
  >('newest')

  // Status confirm dialog state
  const [pendingStatus, setPendingStatus] = useState<UniversityStatus | null>(
    null,
  )
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false)

  const universityQuery = useUniversityDetail(universityId)
  const subscriptionQuery = useUniversitySubscription(universityId)
  const invoicesQuery = useUniversityInvoices(universityId, {
    page: invoicePage,
    limit: 10,
    from: invoiceFromMonth ? `${invoiceFromMonth}-01` : undefined,
    to: invoiceToMonth ? getMonthEndDate(invoiceToMonth) : undefined,
    status: invoiceStatus === 'ALL' ? undefined : invoiceStatus,
    sortBy:
      invoiceSort === 'highest' || invoiceSort === 'lowest'
        ? 'amount'
        : invoiceSort === 'peakSeats'
          ? 'peakSeats'
          : 'billingPeriodStart',
    sortOrder:
      invoiceSort === 'oldest' || invoiceSort === 'lowest' ? 'asc' : 'desc',
  })
  const { updateUniversityStatus } = useUniversityMutations()

  const copyEmail = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleStatusSelect = (status: UniversityStatus) => {
    if (universityQuery.data && universityQuery.data.status !== status) {
      setPendingStatus(status)
      setIsStatusConfirmOpen(true)
    }
  }

  const handleConfirmStatusChange = async () => {
    if (!pendingStatus || !universityQuery.data) return
    await updateUniversityStatus.mutateAsync({
      universityId: universityQuery.data.id,
      status: pendingStatus,
    })
    setIsStatusConfirmOpen(false)
    setPendingStatus(null)
  }

  const sub = subscriptionQuery.data

  if (universityQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (universityQuery.isError || !universityQuery.data) {
    return (
      <div className="space-y-6">
        <Link
          to="/super-admin/universities"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: '-ml-2 mb-2',
          })}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Back to Universities
        </Link>
        <ErrorState
          title="University not found"
          description={
            universityQuery.error instanceof Error
              ? universityQuery.error.message
              : 'Could not load university profile. Please check the identifier and try again.'
          }
          onRetry={() => void universityQuery.refetch()}
          isRetrying={universityQuery.isFetching}
        />
      </div>
    )
  }

  const university = universityQuery.data

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to="/super-admin/universities"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: '-ml-2 mb-1',
          })}
        >
          <ArrowLeft className="size-4 mr-1.5" />
          Back to Universities
        </Link>
      </div>

      {/* Header Profile Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="size-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {university.name}
              </h1>
              <Badge variant="outline" className="font-mono text-xs">
                {university.code}
              </Badge>
              <StatusBadge status={university.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              University account and subscription management
            </p>
          </div>
        </div>

        {/* Header Actions: Edit Details & Status Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditSection('university')
              setIsEditDialogOpen(true)
            }}
          >
            <Edit2 className="size-3.5 mr-1.5" aria-hidden />
            Edit Details
          </Button>

          {/* Status Dropdown Menu with Confirm Dialog */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateUniversityStatus.isPending}
                >
                  <Shield className="size-3.5 mr-1.5" aria-hidden />
                  <span>
                    Status:{' '}
                    <strong className="capitalize font-semibold">
                      {university.status.toLowerCase()}
                    </strong>
                  </span>
                  <ChevronDown
                    className="size-3.5 ml-1.5 opacity-60"
                    aria-hidden
                  />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={university.status === 'ACTIVE'}
                onClick={() => handleStatusSelect('ACTIVE')}
              >
                <ShieldCheck className="size-4 mr-2 text-emerald-500" />
                <span>Active</span>
                {university.status === 'ACTIVE' ? (
                  <Check className="size-3.5 ml-auto" />
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={university.status === 'INACTIVE'}
                onClick={() => handleStatusSelect('INACTIVE')}
              >
                <Clock className="size-4 mr-2 text-amber-500" />
                <span>Inactive</span>
                {university.status === 'INACTIVE' ? (
                  <Check className="size-3.5 ml-auto" />
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={university.status === 'SUSPENDED'}
                onClick={() => handleStatusSelect('SUSPENDED')}
                className="text-destructive focus:text-destructive"
              >
                <ShieldAlert className="size-4 mr-2" />
                <span>Suspended</span>
                {university.status === 'SUSPENDED' ? (
                  <Check className="size-3.5 ml-auto" />
                ) : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 4 Detail Tabs */}
      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 sm:grid-cols-4">
          <TabsTrigger
            value="general"
            className="h-11 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Info className="size-3.5 mr-1.5" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="manager"
            className="h-11 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <User className="size-3.5 mr-1.5" />
            Manager
          </TabsTrigger>
          <TabsTrigger
            value="pricing"
            className="h-11 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <CreditCard className="size-3.5 mr-1.5" />
            Plan & Pricing
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="h-11 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <ReceiptText className="size-3.5 mr-1.5" />
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GENERAL INFO (Clean, focused institution identity) */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Institution Profile & Identification
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditSection('university')
                  setIsEditDialogOpen(true)
                }}
              >
                <Edit2 className="size-3.5 mr-1.5" aria-hidden />
                Edit Information
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    University Full Name
                  </span>
                  <p className="text-base font-semibold text-foreground mt-1">
                    {university.name}
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Short Identifier / Code
                  </span>
                  <p className="font-mono text-base font-semibold text-foreground mt-1">
                    {university.code}
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lifecycle Status
                  </span>
                  <div className="mt-1.5">
                    <StatusBadge status={university.status} />
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Provisioning Timestamp
                  </span>
                  <p className="font-medium text-foreground mt-1">
                    {formatDate(university.createdAt)}
                  </p>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Modified
                  </span>
                  <p className="font-medium text-foreground mt-1">
                    {formatDate(university.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: MANAGER (With Edit Manager Info support) */}
        <TabsContent value="manager" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Primary Administrator (Owner)
              </CardTitle>
              {university.owner ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditSection('manager')
                    setIsEditDialogOpen(true)
                  }}
                >
                  <Edit2 className="size-3.5 mr-1.5" aria-hidden />
                  Edit Manager Info
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {university.owner ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4 rounded-xl border bg-muted/20 p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="size-6" aria-hidden />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {university.owner.displayName}
                          </h3>
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
                          <Badge variant="outline" className="text-xs">
                            University Admin
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <a
                            href={`mailto:${university.owner.email}`}
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                          >
                            <Mail className="size-3.5" aria-hidden />
                            {university.owner.email}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyEmail(university.owner!.email)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                            title="Copy email"
                          >
                            {copiedEmail ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs">
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <span className="text-muted-foreground uppercase tracking-wider font-semibold">
                        Authority & Scope
                      </span>
                      <p className="font-medium text-foreground mt-1">
                        Tenant Primary Administrator (Full Institution Control)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
                  <ShieldAlert className="size-10 text-muted-foreground/60 mb-3" />
                  <h3 className="font-medium text-foreground">
                    No Primary Administrator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    There is currently no administrator assigned as the primary
                    owner of this institution tenant.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setEditSection('manager')
                      setIsEditDialogOpen(true)
                    }}
                  >
                    <UserPlus className="size-3.5 mr-1.5" />
                    Assign Administrator
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CURRENT PLAN & PRICING (With Update Pricing action) */}
        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                Institutional Subscription & Pricing
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPriceDialogOpen(true)}
              >
                <Edit2 className="size-3.5 mr-1.5" aria-hidden />
                Update Pricing
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {subscriptionQuery.isLoading ? (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-20 w-full" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ) : sub ? (
                <div className="space-y-6">
                  {/* Plan status banner */}
                  <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="size-5 text-primary" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Active Plan Tier
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.isCustomPrice
                            ? 'Custom negotiated institutional pricing'
                            : 'Standard institutional pricing'}
                        </p>
                      </div>
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
                        ? 'Active Subscription'
                        : sub.subscriptionStatus === 'PENDING_CANCELLATION'
                          ? 'Pending Cancellation'
                          : 'Cancelled'}
                    </Badge>
                  </div>

                  {/* Pricing KPI metrics */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border bg-card p-4 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Rate per Seat
                      </span>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {formatCurrency(
                          sub.effectivePricePerSeat,
                          sub.currency,
                        )}
                      </p>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {sub.isCustomPrice
                          ? 'Custom override'
                          : 'Default standard rate'}
                      </span>
                    </div>

                    <div className="rounded-xl border bg-card p-4 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Peak Students
                      </span>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {sub.peakStudentsCount}
                      </p>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {sub.currentStudentsCount} active students
                      </span>
                    </div>

                    <div className="rounded-xl border bg-card p-4 text-center">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Est. Monthly Total
                      </span>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {formatCurrency(
                          sub.estimatedMonthlyTotal,
                          sub.currency,
                        )}
                      </p>
                      <span className="text-[0.7rem] text-muted-foreground">
                        Current billing cycle
                      </span>
                    </div>
                  </div>

                  {/* Billing cycle & schedule details */}
                  <div className="rounded-xl border bg-muted/10 p-5 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Billing Cycle Details
                    </h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">
                          Current Billing Period
                        </span>
                        <p className="font-medium text-foreground mt-0.5">
                          {formatDate(sub.billingPeriodStart)} –{' '}
                          {formatDate(sub.billingPeriodEnd)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Next Scheduled Billing Date
                        </span>
                        <p className="font-medium text-foreground mt-0.5">
                          {formatDate(sub.nextBillingDate)}
                        </p>
                      </div>
                    </div>

                    {sub.hasNextPriceChange &&
                    sub.nextEffectivePricePerSeat !== null &&
                    sub.nextEffectivePricePerSeat !== undefined ? (
                      <div className="mt-3 rounded-lg bg-blue-500/10 border border-blue-500/30 p-3.5 text-blue-900 dark:text-blue-200">
                        <div className="flex items-center gap-2 font-semibold text-xs">
                          <Sparkles className="size-4" />
                          Upcoming Scheduled Price Adjustment
                        </div>
                        <p className="text-xs mt-1 opacity-90">
                          Starting next billing period, the price per seat will
                          adjust to{' '}
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
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                  <CreditCard className="size-8 text-muted-foreground/60 mb-2" />
                  <p className="font-medium text-foreground">
                    Standard Institutional Billing
                  </p>
                  <p className="text-xs mt-0.5">
                    Click Update Pricing to customize rate overrides for this
                    university.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setIsPriceDialogOpen(true)}
                  >
                    <Edit2 className="size-3.5 mr-1.5" />
                    Configure Pricing
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: INVOICE HISTORY */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-base font-semibold">
                Invoice History
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Finalized invoices for each completed anniversary billing
                period.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">From month</span>
                  <Input
                    type="month"
                    value={invoiceFromMonth}
                    onChange={(event) => {
                      setInvoiceFromMonth(event.target.value)
                      setInvoicePage(1)
                    }}
                    max={invoiceToMonth || undefined}
                    className="bg-background"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">To month</span>
                  <Input
                    type="month"
                    value={invoiceToMonth}
                    onChange={(event) => {
                      setInvoiceToMonth(event.target.value)
                      setInvoicePage(1)
                    }}
                    min={invoiceFromMonth || undefined}
                    className="bg-background"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Payment status</span>
                  <Select
                    value={invoiceStatus}
                    onValueChange={(value) => {
                      if (value) {
                        setInvoiceStatus(value)
                        setInvoicePage(1)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="DUE">Due</SelectItem>
                      <SelectItem value="OVERDUE">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5 text-xs font-medium">
                  <span className="text-muted-foreground">Sort invoices</span>
                  <Select
                    value={invoiceSort}
                    onValueChange={(value) => {
                      if (value) {
                        setInvoiceSort(value)
                        setInvoicePage(1)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                      <SelectItem value="highest">Highest invoice</SelectItem>
                      <SelectItem value="lowest">Lowest invoice</SelectItem>
                      <SelectItem value="peakSeats">
                        Highest peak seats
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              {invoicesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : invoicesQuery.isError ? (
                <ErrorState
                  title="Could not load invoices"
                  description="The invoice history could not be loaded."
                  onRetry={() => void invoicesQuery.refetch()}
                  isRetrying={invoicesQuery.isFetching}
                />
              ) : invoicesQuery.data && invoicesQuery.data.data.length > 0 ? (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Billing period</TableHead>
                        <TableHead className="text-right">Peak seats</TableHead>
                        <TableHead className="text-right">Seat price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Due date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoicesQuery.data.data.map((invoice) => {
                        const overdue =
                          invoice.status === 'DUE' &&
                          new Date(invoice.gracePeriodEnd) <= new Date()
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {formatPeriodDate(invoice.billingPeriodStart)} –{' '}
                              {formatPeriodDate(invoice.billingPeriodEnd)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {invoice.peakSeats}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(
                                invoice.pricePerSeat,
                                invoice.currency,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(invoice.amount, invoice.currency)}
                            </TableCell>
                            <TableCell>
                              {formatPeriodDate(invoice.dueAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invoice.status === 'PAID'
                                    ? 'secondary'
                                    : overdue
                                      ? 'destructive'
                                      : 'outline'
                                }
                              >
                                {invoice.status === 'PAID'
                                  ? 'Paid'
                                  : overdue
                                    ? 'Overdue'
                                    : 'Due'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
                  <ReceiptText className="mb-3 size-9 text-muted-foreground/60" />
                  <p className="font-medium text-foreground">
                    No finalized invoices yet
                  </p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    The first invoice will appear here when the current billing
                    period ends.
                  </p>
                </div>
              )}

              {invoicesQuery.data &&
              invoicesQuery.data.pagination.totalPages > 1 ? (
                <NumberedPagination
                  page={invoicesQuery.data.pagination.page}
                  totalPages={invoicesQuery.data.pagination.totalPages}
                  totalCount={invoicesQuery.data.pagination.totalCount}
                  limit={invoicesQuery.data.pagination.limit}
                  onPageChange={setInvoicePage}
                  itemName="invoices"
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Context-specific edit dialog */}
      <EditUniversityDialog
        university={university}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        section={editSection}
      />

      {/* Edit Custom Pricing Dialog */}
      <EditCustomPriceDialog
        subscription={sub ?? null}
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
      />

      {/* Status Transition ConfirmDialog */}
      <ConfirmDialog
        open={isStatusConfirmOpen}
        onOpenChange={setIsStatusConfirmOpen}
        title={`Change Status to ${pendingStatus}?`}
        description={
          pendingStatus === 'SUSPENDED'
            ? `Are you sure you want to suspend "${university.name}"? All access for students and instructors will be immediately blocked.`
            : `Are you sure you want to change the status of "${university.name}" to ${pendingStatus?.toLowerCase()}?`
        }
        confirmLabel={`Set to ${pendingStatus}`}
        destructive={pendingStatus === 'SUSPENDED'}
        disabled={updateUniversityStatus.isPending}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  )
}
