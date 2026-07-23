import { Link, useRouterState } from '@tanstack/react-router'
import {
  Check,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

import { getUserInitials } from '@/components/layout/get-user-initials'
import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useLogout } from '@/features/auth/hooks/use-logout'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { StudentSidebarContent } from '@/features/student/components/student-sidebar-content'
import { useTheme } from '@/providers/theme-provider'
import { cn } from '@/lib/utils'

export type AppSidebarNavItem = {
  icon: LucideIcon
  label: string
  to: string
  exact?: boolean
}

export type AppSidebarRole = 'student' | 'instructor' | 'admin'

type AppSidebarProps = {
  role: AppSidebarRole
  navigation?: readonly AppSidebarNavItem[]
  ariaLabel?: string
}

const wordmarkTargetByRole: Record<AppSidebarRole, string> = {
  student: '/chat',
  instructor: '/instructor',
  admin: '/admin',
}

const settingsTargetByRole: Record<AppSidebarRole, string> = {
  student: '/settings',
  instructor: '/instructor/settings',
  admin: '/admin/settings',
}

function isActiveNavItem(item: AppSidebarNavItem, pathname: string) {
  if (item.exact ?? item.to === '/') {
    return pathname === item.to || pathname === `${item.to}/`
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function StaffSidebarContent({
  navigation,
  ariaLabel,
  pathname,
}: {
  navigation: readonly AppSidebarNavItem[]
  ariaLabel: string
  pathname: string
}) {
  return (
    <SidebarMenu aria-label={ariaLabel} className="gap-0.5 px-2 pt-2">
      {navigation.map((item) => {
        const Icon = item.icon
        const isActive = isActiveNavItem(item, pathname)

        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              isActive={isActive}
              render={
                <Link
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                />
              }
            >
              <Icon aria-hidden strokeWidth={1.75} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function SidebarFooterUser({ role }: { role: AppSidebarRole }) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const { theme, setTheme } = useTheme()

  const displayName = user?.displayName ?? 'Account'
  const email = user?.email ?? ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-sidebar-accent"
            aria-label="Account menu"
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-foreground">
            {getUserInitials(user?.displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-sidebar-foreground">
            {displayName}
          </span>
          {email ? (
            <span className="footnote block truncate">{email}</span>
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem render={<Link to={settingsTargetByRole[role]} />}>
          <Settings aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun aria-hidden />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme('light')}>
              {theme === 'light' ? <Check aria-hidden /> : <Sun aria-hidden />}
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              {theme === 'dark' ? <Check aria-hidden /> : <Moon aria-hidden />}
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              {theme === 'system' ? (
                <Check aria-hidden />
              ) : (
                <Monitor aria-hidden />
              )}
              System
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CollapsedCluster({
  role,
  searchInputRef,
  newChatButtonRef,
}: {
  role: AppSidebarRole
  searchInputRef: React.RefObject<HTMLInputElement | null>
  newChatButtonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar()

  // On desktop the cluster stands in for the trigger only while collapsed. On
  // mobile the sidebar is always an off-canvas sheet, so students (who have no
  // top bar of their own) always need this cluster to reopen it.
  const isVisible = state === 'collapsed' || (isMobile && role === 'student')

  if (!isVisible) {
    return null
  }

  const expandThen = (action: () => void) => {
    if (isMobile) {
      setOpenMobile(true)
    } else {
      setOpen(true)
    }
    requestAnimationFrame(() => action())
  }

  return (
    <div className="glass-paper fixed top-3 left-3 z-50 flex gap-1 rounded-xl p-1 shadow-sm">
      <SidebarTrigger />
      {role === 'student' ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Search your chats"
            onClick={() => expandThen(() => searchInputRef.current?.focus())}
          >
            <Search aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            onClick={() => expandThen(() => newChatButtonRef.current?.click())}
          >
            <Plus aria-hidden />
          </Button>
        </>
      ) : null}
    </div>
  )
}

export function AppSidebar({ role, navigation, ariaLabel }: AppSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const newChatButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Sidebar variant="sidebar" collapsible="offcanvas">
        <SidebarHeader className="flex-row items-center gap-2 px-3 pt-3">
          <SidebarTrigger className="-ml-1" />
          <Link
            to={wordmarkTargetByRole[role]}
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Logo className="size-6 text-foreground" iconClassName="size-4.5" />
            <span
              className={cn(
                'font-display text-[1.125rem] leading-none text-sidebar-foreground',
              )}
            >
              Morshid
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {role === 'student' ? (
            <StudentSidebarContent
              searchInputRef={searchInputRef}
              newChatButtonRef={newChatButtonRef}
            />
          ) : (
            <StaffSidebarContent
              navigation={navigation ?? []}
              ariaLabel={ariaLabel ?? 'Navigation'}
              pathname={pathname}
            />
          )}
        </SidebarContent>

        <SidebarFooter className="p-2">
          <SidebarFooterUser role={role} />
        </SidebarFooter>
      </Sidebar>

      <CollapsedCluster
        role={role}
        searchInputRef={searchInputRef}
        newChatButtonRef={newChatButtonRef}
      />
    </>
  )
}
