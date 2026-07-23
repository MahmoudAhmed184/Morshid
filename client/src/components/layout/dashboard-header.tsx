import { Bell, HelpCircle, Search } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function getUserInitials(displayName?: string, fallback = 'U') {
  if (!displayName) {
    return fallback
  }

  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || fallback
  )
}

type DashboardHeaderProps = {
  displayName?: string
  email?: string
  searchLabel: string
  searchPlaceholder: string
  leading?: React.ReactNode
  content?: React.ReactNode
  showHelp?: boolean
  className?: string
}

export function DashboardHeader({
  displayName,
  email,
  searchLabel,
  searchPlaceholder,
  leading,
  content,
  showHelp = true,
  className,
}: DashboardHeaderProps) {
  const initials = getUserInitials(displayName)

  return (
    <header
      className={cn(
        'flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6',
        className,
      )}
    >
      {leading}

      {content ? (
        <div className="min-w-0 flex-1">{content}</div>
      ) : (
        <div className="relative hidden min-w-0 flex-1 sm:block">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="workspace-search"
            autoComplete="off"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            className="h-9 bg-background pl-9"
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </Button>
        {showHelp ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Help"
          >
            <HelpCircle className="size-4" aria-hidden />
          </Button>
        ) : null}
        <div className="hidden text-right sm:block">
          <p className="max-w-40 truncate text-xs font-medium text-foreground">
            {displayName ?? 'User'}
          </p>
          {email ? (
            <p className="max-w-40 truncate text-[0.68rem] text-muted-foreground">
              {email}
            </p>
          ) : null}
        </div>
        <Avatar
          className="bg-primary text-primary-foreground"
          aria-label={displayName}
        >
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
