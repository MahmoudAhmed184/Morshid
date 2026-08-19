import {
  ArrowUpDown,
  GraduationCap,
  Landmark,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
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
import type {
  SortOrder,
  UniversitySortField,
  UniversityStatus,
} from '@/features/universities/universities.schema'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { CreateUniversityDialog } from './create-university-dialog'
import { UniversitiesTable } from './universities-table'
import { useUniversities } from './use-universities'

type StatusFilter = 'ALL' | UniversityStatus

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'studentsCount:desc', label: 'Most students' },
  { value: 'studentsCount:asc', label: 'Fewest students' },
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'code:asc', label: 'Code (A-Z)' },
  { value: 'code:desc', label: 'Code (Z-A)' },
  { value: 'status:asc', label: 'Status (A-Z)' },
]

export function UniversitiesPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const [sortBy, setSortBy] = useState<UniversitySortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const queryInput = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      sortBy,
      sortOrder,
    }),
    [debouncedSearch, limit, page, sortBy, sortOrder, statusFilter],
  )

  const universitiesQuery = useUniversities(queryInput)

  const data = useMemo(
    () => universitiesQuery.data?.data ?? [],
    [universitiesQuery.data?.data],
  )
  const pagination = universitiesQuery.data?.pagination

  const totalCount = pagination?.totalCount ?? 0
  const totalPages = pagination?.totalPages ?? 1

  const activeCount = useMemo(
    () => data.filter((uni) => uni.status === 'ACTIVE').length,
    [data],
  )
  const suspendedCount = useMemo(
    () => data.filter((uni) => uni.status === 'SUSPENDED').length,
    [data],
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleStatusFilterChange = (value: StatusFilter | null) => {
    if (!value) return
    setStatusFilter(value)
    setPage(1)
  }

  const handleSortChange = (value: string | null) => {
    if (!value) return
    const [field, order] = value.split(':') as [UniversitySortField, SortOrder]
    setSortBy(field)
    setSortOrder(order)
    setPage(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setSortBy('createdAt')
    setSortOrder('desc')
    setPage(1)
  }

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    sortBy !== 'createdAt' ||
    sortOrder !== 'desc'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Administration"
        title="Universities"
        description="Provision universities, manage tenant lifecycles, and configure primary administrator ownership across Morshid."
        actions={<CreateUniversityDialog />}
      />

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Universities"
          value={totalCount}
          icon={<Landmark />}
          tone="default"
          description="Provisioned university tenants"
        />
        <StatCard
          label="Active Tenants"
          value={statusFilter === 'ACTIVE' ? totalCount : activeCount}
          icon={<ShieldCheck />}
          tone="success"
          description="Universities with active status"
        />
        <StatCard
          label="Suspended Tenants"
          value={statusFilter === 'SUSPENDED' ? totalCount : suspendedCount}
          icon={<ShieldAlert />}
          tone="warning"
          description="Blocked from tenant operations"
        />
      </div>

      {/* Toolbar */}
      <DataToolbar
        search={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search universities by name or code..."
        filters={
          <div className="flex items-center gap-2">
            <Select
              items={STATUS_OPTIONS}
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[140px]" aria-label="Status filter">
                <SelectValue placeholder="All Statuses">
                  {(val) =>
                    STATUS_OPTIONS.find((opt) => opt.value === val)?.label ??
                    'All Statuses'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={SORT_OPTIONS}
              value={`${sortBy}:${sortOrder}`}
              onValueChange={handleSortChange}
            >
              <SelectTrigger className="w-[170px]" aria-label="Sort order">
                <ArrowUpDown className="size-3.5 text-muted-foreground mr-1" />
                <SelectValue placeholder="Sort by">
                  {(val) =>
                    SORT_OPTIONS.find((opt) => opt.value === val)?.label ??
                    'Sort by'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Content State */}
      {universitiesQuery.isLoading ? (
        <div className="space-y-3 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : universitiesQuery.isError ? (
        <ErrorState
          title="Failed to load universities"
          description={
            universitiesQuery.error instanceof Error
              ? universitiesQuery.error.message
              : 'Could not fetch university records. Please retry.'
          }
          onRetry={() => universitiesQuery.refetch()}
          isRetrying={universitiesQuery.isFetching}
        />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<GraduationCap />}
          title={
            hasActiveFilters
              ? 'No universities match your filters'
              : 'No universities provisioned yet'
          }
          description={
            hasActiveFilters
              ? 'Try changing or clearing your search term and status filters.'
              : 'Get started by creating the first university tenant and owner administrator.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            ) : (
              <CreateUniversityDialog />
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <UniversitiesTable universities={data} />

          {/* Numbered Pagination */}
          <NumberedPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={limit}
            onPageChange={setPage}
            disabled={universitiesQuery.isFetching}
            itemName="universities"
          />
        </div>
      )}
    </div>
  )
}
