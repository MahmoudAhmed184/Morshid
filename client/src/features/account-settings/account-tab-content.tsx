import { LogOut, UserRound } from 'lucide-react'

import { getUserInitials } from '@/components/branding/get-user-initials'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SignOutButton } from '@/features/auth/session/interface/sign-out-button'
import { useAuthStore } from '@/features/auth/session/interface/session-store'

const roleLabelByRole = {
  ADMIN: 'Administrator',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
} as const

export function AccountTabContent() {
  const user = useAuthStore((state) => state.user)
  const roleName = user ? roleLabelByRole[user.role] : 'Account'
  const displayName = user?.displayName ?? roleName

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-5 px-5 py-5 sm:px-6">
          <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            Profile
          </h2>
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-16 bg-primary text-primary-foreground">
              <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-accent text-accent-foreground"
                >
                  {roleName}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="-mx-4 rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <LogOut className="size-4 text-muted-foreground" aria-hidden />
              Account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage your session and account settings.
            </p>
          </div>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
