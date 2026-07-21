import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type AppSidebarNavItem = {
  icon: LucideIcon
  label: string
  to: string
  exact?: boolean
}

type AppSidebarProps = {
  navigation: readonly AppSidebarNavItem[]
  settings: AppSidebarNavItem
  pathname: string
  ariaLabel: string
  header: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  onNavigate?: () => void
  className?: string
  navigationClassName?: string
  itemClassName?: string
  activeItemClassName?: string
  settingsContainerClassName?: string
}

function isActiveItem(item: AppSidebarNavItem, pathname: string) {
  if (item.exact ?? item.to === '/') {
    return pathname === item.to || pathname === `${item.to}/`
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

type AppSidebarLinkProps = {
  item: AppSidebarNavItem
  pathname: string
  onNavigate?: () => void
  itemClassName?: string
  activeItemClassName?: string
}

function AppSidebarLink({
  item,
  pathname,
  onNavigate,
  itemClassName,
  activeItemClassName,
}: AppSidebarLinkProps) {
  const Icon = item.icon
  const isActive = isActiveItem(item, pathname)

  return (
    <Link
      to={item.to}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive || undefined}
      onClick={onNavigate}
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        itemClassName,
        isActive && activeItemClassName,
      )}
    >
      <Icon className="size-4 shrink-0 transition-transform" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export function AppSidebar({
  navigation,
  settings,
  pathname,
  ariaLabel,
  header,
  footer,
  children,
  onNavigate,
  className,
  navigationClassName,
  itemClassName,
  activeItemClassName,
  settingsContainerClassName,
}: AppSidebarProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      {header}

      <nav className={navigationClassName} aria-label={ariaLabel}>
        {navigation.map((item) => (
          <AppSidebarLink
            key={item.to}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            itemClassName={itemClassName}
            activeItemClassName={activeItemClassName}
          />
        ))}
      </nav>

      {children}
      {footer}
      <div className={settingsContainerClassName}>
        <AppSidebarLink
          item={settings}
          pathname={pathname}
          onNavigate={onNavigate}
          itemClassName={itemClassName}
          activeItemClassName={activeItemClassName}
        />
      </div>
    </div>
  )
}
