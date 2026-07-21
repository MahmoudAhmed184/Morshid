import { LogOut } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import type { AppSidebarNavItem } from '@/components/layout/app-sidebar'
import { getUserInitials } from '@/components/layout/dashboard-header'
import { Logo } from '@/components/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/hooks/use-logout'
import { cn } from '@/lib/utils'

type StudioSidebarUser = {
  displayName?: string
  roleLabel: string
}

type StudioSidebarProps = {
  navigation: readonly AppSidebarNavItem[]
  roleChip: string
  ariaLabel: string
  pathname: string
  user?: StudioSidebarUser
  onNavigate?: () => void
}

const itemClassName = cn(
  'group relative flex h-10 w-full items-center gap-3 rounded-xl px-3',
  'text-sm font-medium text-sidebar-foreground/75 transition-colors',
  'hover:bg-secondary/60 hover:text-sidebar-foreground',
)

const activeItemClassName = cn(
  'bg-sidebar-accent text-sidebar-accent-foreground',
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  'before:absolute before:top-1/2 before:left-0 before:h-5 before:w-0.5',
  "before:-translate-y-1/2 before:rounded-full before:bg-rubric before:content-['']",
)

function StudioUserCard({ user }: { user: StudioSidebarUser }) {
  const logout = useLogout()

  return (
    <div className="mt-auto p-3">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground"
          aria-hidden
        >
          {getUserInitials(user.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user.displayName ?? user.roleLabel}
          </p>
          <p className="footnote truncate">{user.roleLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void logout()}
          aria-label="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

export function StudioSidebar({
  navigation,
  roleChip,
  ariaLabel,
  pathname,
  user,
  onNavigate,
}: StudioSidebarProps) {
  return (
    <AppSidebar
      navigation={navigation}
      pathname={pathname}
      ariaLabel={ariaLabel}
      onNavigate={onNavigate}
      className="bg-sidebar text-sidebar-foreground"
      navHeading="Menu"
      header={
        <div className="flex items-center gap-2.5 px-4 pt-4">
          <Logo className="size-5 text-foreground" iconClassName="size-5" />
          <span className="font-display text-[1.125rem] font-semibold text-sidebar-foreground">
            Morshid
          </span>
          <Badge variant="secondary" className="ml-auto">
            {roleChip}
          </Badge>
        </div>
      }
      navigationClassName="flex flex-1 flex-col gap-1 overflow-y-auto scrollbar-themed px-3 pt-6"
      itemClassName={itemClassName}
      activeItemClassName={activeItemClassName}
      footer={user ? <StudioUserCard user={user} /> : null}
    />
  )
}
