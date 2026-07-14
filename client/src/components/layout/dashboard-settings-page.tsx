import { Palette, UserRound } from 'lucide-react'

import { getUserInitials } from '@/components/layout/dashboard-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type DashboardSettingsPageProps = {
  roleName: string
}

export function DashboardSettingsPage({
  roleName,
}: DashboardSettingsPageProps) {
  const user = useAuthStore((state) => state.user)
  const displayName = user?.displayName ?? roleName

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and workspace preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4" aria-hidden />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar size="lg" className="bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
              {getUserInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <dl className="min-w-0 space-y-1">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd className="truncate font-medium text-foreground">
                {displayName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="truncate text-sm text-foreground">
                {user?.email ?? 'Not available'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Role</dt>
              <dd className="text-sm text-foreground">{roleName}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4" aria-hidden />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Choose a color theme and appearance mode.
          </p>
          <ModeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
