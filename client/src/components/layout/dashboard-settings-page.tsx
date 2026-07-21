import { LogOut, Palette, UserRound } from 'lucide-react'

import { getUserInitials } from '@/components/layout/dashboard-header'
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
import { ModeToggle } from '@/components/ui/mode-toggle'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type DashboardSettingsPageProps = {
  roleName: string
  embedded?: boolean
}

export function DashboardSettingsPage({
  roleName,
  embedded = false,
}: DashboardSettingsPageProps) {
  const user = useAuthStore((state) => state.user)
  const displayName = user?.displayName ?? roleName

  return (
    <div
      className={
        embedded
          ? 'space-y-6'
          : 'mx-auto w-full max-w-3xl space-y-6 px-4 py-5 sm:px-6'
      }
    >
      {embedded ? null : (
        <PageHeader
          eyebrow="Workspace"
          title="Settings"
          description="Manage your profile and workspace preferences."
        />
      )}

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" aria-hidden />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose a color theme and appearance mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Theme and mode</p>
          <ModeToggle />
        </CardContent>
      </Card>

      <Card>
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
