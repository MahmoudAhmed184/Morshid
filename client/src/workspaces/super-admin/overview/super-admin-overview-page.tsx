import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Landmark,
  Presentation,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state/empty-state'
import { ErrorState } from '@/components/ui/custom/error-state/error-state'
import { PageHeader } from '@/components/ui/custom/page-header/page-header'
import { StatCard } from '@/components/ui/custom/stat-card/stat-card'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateUniversityDialog } from '../universities/create-university-dialog'
import { useUniversities } from '../universities/use-universities'

export function SuperAdminOverviewPage() {
  const universitiesQuery = useUniversities({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  const universities = useMemo(
    () => universitiesQuery.data?.data ?? [],
    [universitiesQuery.data?.data],
  )
  const pagination = universitiesQuery.data?.pagination

  const totalCount = pagination?.totalCount ?? 0

  const activeCount = useMemo(
    () => universities.filter((u) => u.status === 'ACTIVE').length,
    [universities],
  )
  const suspendedCount = useMemo(
    () => universities.filter((u) => u.status === 'SUSPENDED').length,
    [universities],
  )
  const totalStudents = useMemo(
    () => universities.reduce((sum, u) => sum + u.studentsCount, 0),
    [universities],
  )
  const totalInstructors = useMemo(
    () => universities.reduce((sum, u) => sum + u.instructorsCount, 0),
    [universities],
  )
  const totalCourses = useMemo(
    () => universities.reduce((sum, u) => sum + u.coursesCount, 0),
    [universities],
  )

  const quickNav = [
    {
      title: 'Manage Universities',
      description: 'View, filter, provision, and configure university tenants',
      to: '/super-admin/universities',
      icon: Landmark,
    },
    {
      title: 'Super Admin Settings',
      description: 'Account settings, theme preferences, and security options',
      to: '/super-admin/settings',
      icon: Settings,
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="PLATFORM MANAGEMENT"
        title="Super Admin Overview"
        description="Global summary of provisioned university tenants, community size, and system access."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              render={<Link to="/super-admin/universities" />}
            >
              View All Universities
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <CreateUniversityDialog />
          </div>
        }
      />

      {/* Global Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Universities"
          value={totalCount}
          icon={<Landmark />}
          tone="default"
          description="Provisioned university tenants"
        />
        <StatCard
          label="Active Tenants"
          value={activeCount}
          icon={<ShieldCheck />}
          tone="success"
          description="Universities with active status"
        />
        <StatCard
          label="Suspended Tenants"
          value={suspendedCount}
          icon={<ShieldAlert />}
          tone="warning"
          description="Universities with suspended access"
        />
        <StatCard
          label="Students"
          value={totalStudents}
          icon={<GraduationCap />}
          tone="info"
          description="Enrolled student learners across active tenants"
        />
        <StatCard
          label="Instructors"
          value={totalInstructors}
          icon={<Presentation />}
          tone="default"
          description="Active teaching staff across active tenants"
        />
        <StatCard
          label="Courses"
          value={totalCourses}
          icon={<BookOpen />}
          tone="success"
          description="Total learning course shells configured"
        />
      </div>

      {/* Main Grid: Recent Universities & Quick Navigation */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent Universities Panel */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Recently Provisioned Universities
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest tenants registered on the Morshid platform.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              render={<Link to="/super-admin/universities" />}
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </CardHeader>

          <CardContent>
            {universitiesQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : universitiesQuery.isError ? (
              <ErrorState
                title="Failed to load universities"
                description="Could not load recent university records."
                onRetry={() => universitiesQuery.refetch()}
                isRetrying={universitiesQuery.isFetching}
              />
            ) : universities.length === 0 ? (
              <EmptyState
                icon={<Landmark />}
                title="No universities provisioned yet"
                description="Get started by provisioning the first university tenant."
                action={<CreateUniversityDialog />}
              />
            ) : (
              <div className="divide-y rounded-lg border">
                {universities.slice(0, 5).map((uni) => (
                  <div
                    key={uni.id}
                    className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {uni.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[0.7rem]"
                        >
                          {uni.code}
                        </Badge>
                        <StatusBadge status={uni.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Owner:{' '}
                        {uni.owner ? (
                          <span className="text-foreground">
                            {uni.owner.displayName} ({uni.owner.email})
                          </span>
                        ) : (
                          <span className="italic">None</span>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap"
                        title="Students"
                      >
                        <GraduationCap className="size-3.5 text-primary/70" />
                        <span className="font-medium text-foreground">
                          {uni.studentsCount}
                        </span>{' '}
                        Students
                      </span>
                      <span className="text-muted-foreground/40" aria-hidden>
                        •
                      </span>
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap"
                        title="Instructors"
                      >
                        <Presentation className="size-3.5 text-primary/70" />
                        <span className="font-medium text-foreground">
                          {uni.instructorsCount}
                        </span>{' '}
                        Instructors
                      </span>
                      <span className="text-muted-foreground/40" aria-hidden>
                        •
                      </span>
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap"
                        title="Courses"
                      >
                        <BookOpen className="size-3.5 text-primary/70" />
                        <span className="font-medium text-foreground">
                          {uni.coursesCount}
                        </span>{' '}
                        Courses
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Navigation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Quick Navigation
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Direct access to platform control panels.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickNav.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
