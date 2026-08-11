import { LogOut, Monitor, Moon, Palette, Sun, UserRound } from 'lucide-react'

import { getUserInitials } from '@/components/branding/get-user-initials'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/ui/custom/page-header'
import { SignOutButton } from '@/features/auth/session/sign-out-button'
import { useAuthStore } from '@/features/auth/session/session.store'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/theme/theme-provider'

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const roleLabelByRole = {
  ADMIN: 'Administrator',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
} as const

export function AccountSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const { theme, setTheme } = useTheme()
  const roleName = user ? roleLabelByRole[user.role] : 'Account'
  const displayName = user?.displayName ?? roleName

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-5 sm:px-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your profile and workspace preferences."
      />

      <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="bg-secondary text-foreground">
              <AvatarFallback className="bg-secondary text-base font-semibold text-foreground">
                {getUserInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {displayName}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {user?.email ?? 'Not available'}
              </p>
              <Badge variant="secondary" className="mt-2">
                {roleName}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" aria-hidden />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose a color theme and appearance mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">Theme mode</p>

          <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-border/80 bg-muted/50 p-1.5 shadow-xs sm:w-auto sm:inline-flex">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = theme === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium sm:px-3.5 sm:text-sm transition-colors cursor-pointer select-none min-w-0',
                    isActive
                      ? 'bg-background text-foreground font-semibold shadow-xs border border-border/40'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5 sm:size-4 shrink-0" aria-hidden />
                  <span className="truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="size-4 text-muted-foreground" aria-hidden />
            Account
          </CardTitle>
          <CardDescription>
            Sign out of your Morshid workspace on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
