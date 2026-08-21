import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/ui/custom/page-header'
import { cn } from '@/lib/utils'
import type { SettingsTabDescriptor } from './settings-tab.types'

export type SettingsShellProps = {
  readonly eyebrow?: string
  readonly title?: string
  readonly description?: string
  readonly tabs: readonly SettingsTabDescriptor[]
  readonly children?: ReactNode
}

export function SettingsContentSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      data-slot="settings-skeleton"
      aria-label="Loading settings content"
      role="status"
    >
      <div className="h-32 rounded-xl bg-muted/60" />
      <div className="h-48 rounded-xl bg-muted/60" />
    </div>
  )
}

export function SettingsShell({
  eyebrow = 'Workspace',
  title = 'Settings',
  description = 'Manage your profile and workspace preferences.',
  tabs,
  children,
}: SettingsShellProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  // Match active tab based on route pathname
  const activeTab =
    tabs.find((tab) =>
      tab.exact
        ? pathname === tab.to || pathname === `${tab.to}/`
        : pathname === tab.to || pathname.startsWith(`${tab.to}/`),
    ) ?? tabs[0]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <PageHeader
        className="border-b-0 pb-1"
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {/* Horizontal pill tabs bar */}
      <div className="overflow-x-auto py-1 no-scrollbar max-w-full">
        <div className="inline-flex min-w-full sm:min-w-0 p-0.5">
          <nav
            aria-label="Settings navigation"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/60 p-1.5 text-sm font-medium shadow-2xs backdrop-blur-xs"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab.id === tab.id

              return (
                <Link
                  key={tab.id}
                  to={tab.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
                    isActive
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  )}
                >
                  {Icon ? (
                    <Icon className="size-4 shrink-0" aria-hidden />
                  ) : null}
                  <span className="whitespace-nowrap leading-none">
                    {tab.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Active tab content region */}
      <div
        role="region"
        aria-label={`${activeTab.label} settings`}
        tabIndex={0}
        className="min-w-0 flex-1 focus-visible:outline-none"
      >
        {children ?? <Outlet />}
      </div>
    </div>
  )
}
