import {
  Coins,
  CreditCard,
  DollarSign,
  Landmark,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataToolbar } from '@/components/ui/custom/data-toolbar/data-toolbar'
import { EmptyState } from '@/components/ui/custom/empty-state/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state/error-state'
import { PageHeader } from '@/components/ui/custom/page-header/page-header'
import { NumberedPagination } from '@/components/ui/custom/pagination'
import { StatCard } from '@/components/ui/custom/stat-card/stat-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useGlobalPricing,
  useSubscriptions,
} from '@/features/subscriptions/interface'
import type { SubscriptionStatus } from '@/features/subscriptions/interface'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { GlobalPricingCard } from './global-pricing-card'
import { SubscriptionsTable } from './subscriptions-table'

type StatusFilter = 'ALL' | SubscriptionStatus

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_CANCELLATION', label: 'Pending Cancellation' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function SuperAdminSubscriptionsPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const globalPricingQuery = useGlobalPricing()
  const subscriptionsQuery = useSubscriptions({
    page,
    limit,
    search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    sortBy: 'name',
    sortOrder: 'asc',
  })

  const data = useMemo(
    () => subscriptionsQuery.data?.data ?? [],
    [subscriptionsQuery.data?.data],
  )
  const pagination = subscriptionsQuery.data?.pagination
  const summary = subscriptionsQuery.data?.summary

  const totalCount = pagination?.totalCount ?? 0
  const totalPages = pagination?.totalPages ?? 1

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleStatusFilterChange = (value: string | null) => {
    if (value) {
      setStatusFilter(value as StatusFilter)
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions & Pricing"
        description="Configure global seat pricing, set custom university overrides, and monitor peak student usage across all institutions."
      />

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Coins />}
          tone="default"
          label="Default Seat Rate"
          value={
            globalPricingQuery.data
              ? `$${globalPricingQuery.data.defaultPricePerSeat.toFixed(2)}`
              : '—'
          }
          description="Standard monthly rate per student seat"
        />
        <StatCard
          icon={<Landmark />}
          tone="info"
          label="Subscribed Universities"
          value={summary?.totalSubscribedUniversities ?? 0}
          description="Active institutional accounts"
        />
        <StatCard
          icon={<TrendingUp />}
          tone="warning"
          label="Peak Billed Seats"
          value={summary?.totalPeakStudents ?? 0}
          description="High-water mark seats billed this month"
        />
        <StatCard
          icon={<DollarSign />}
          tone="success"
          label="Estimated Monthly Revenue"
          value={
            summary ? `$${summary.totalEstimatedRevenue.toFixed(2)}` : '$0.00'
          }
          description="Projected billings for current cycle"
        />
      </div>

      {/* Global Pricing Overview Card */}
      <GlobalPricingCard
        pricing={globalPricingQuery.data ?? null}
        isLoading={globalPricingQuery.isLoading}
      />

      {/* Toolbar & Filter */}
      <DataToolbar
        searchPlaceholder="Search universities by name or code..."
        search={search}
        onSearchChange={handleSearchChange}
        filters={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Subscriptions Data Section */}
      {subscriptionsQuery.isError ? (
        <ErrorState
          title="Failed to load subscriptions"
          description={
            subscriptionsQuery.error.message ||
            'An unexpected error occurred while loading university subscriptions.'
          }
          onRetry={() => void subscriptionsQuery.refetch()}
        />
      ) : subscriptionsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-6" />}
          title="No subscriptions found"
          description={
            debouncedSearch || statusFilter !== 'ALL'
              ? 'Try changing your search terms or filter settings.'
              : 'There are no university subscriptions configured yet.'
          }
        />
      ) : (
        <div className="space-y-4">
          <SubscriptionsTable subscriptions={data} />

          {totalPages > 1 ? (
            <NumberedPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              limit={limit}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
