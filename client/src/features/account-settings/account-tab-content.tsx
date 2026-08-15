import type { FormEvent } from 'react'
import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  UserRound,
} from 'lucide-react'

import { getUserInitials } from '@/components/branding/get-user-initials'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { SignOutButton } from '@/features/auth/session/interface/sign-out-button'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { updateOwnProfile } from '@/features/auth/session/interface/account-profile'

const roleLabelByRole = {
  ADMIN: 'Administrator',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
} as const

export function AccountTabContent() {
  const user = useAuthStore((state) => state.user)
  const roleName = user ? roleLabelByRole[user.role] : 'Account'
  const displayName = user?.displayName ?? roleName

  const [displayNameInput, setDisplayNameInput] = useState(
    user?.displayName ?? '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const trimmedInput = displayNameInput.trim()
  const isUnchanged = trimmedInput === (user?.displayName ?? '').trim()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (trimmedInput.length < 2) {
      setSuccessMessage(null)
      setErrorMessage('Display name must be at least 2 characters.')
      return
    }

    if (trimmedInput.length > 120) {
      setSuccessMessage(null)
      setErrorMessage('Display name must not exceed 120 characters.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const updatedUser = await updateOwnProfile({
        displayName: trimmedInput,
      })

      useAuthStore.getState().setUser(updatedUser)
      setDisplayNameInput(updatedUser.displayName)
      setSuccessMessage('Profile updated successfully.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to update profile. Please try again.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <UserRound className="size-4 text-muted-foreground" aria-hidden />
              Profile
            </h2>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-16 bg-primary text-primary-foreground">
              <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
                {getUserInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
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
                <Badge
                  variant="outline"
                  className={
                    user?.status === 'ACTIVE'
                      ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'border-destructive/30 text-destructive'
                  }
                >
                  {user?.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                name="displayName"
                value={displayNameInput}
                onChange={(e) => {
                  setDisplayNameInput(e.target.value)
                  if (successMessage || errorMessage) {
                    setSuccessMessage(null)
                    setErrorMessage(null)
                  }
                }}
                disabled={isSubmitting}
                maxLength={120}
                placeholder="Enter display name"
                autoComplete="name"
                required
              />
              <p className="text-xs text-muted-foreground">
                2 to 120 characters. This name is shown across courses, tutoring
                sessions, and reviews.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Email address
                </Label>
                <p className="text-sm font-medium text-foreground">
                  {user?.email ?? 'Not available'}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <p className="text-sm font-medium text-foreground">
                  {roleName}
                </p>
              </div>
            </div>

            {successMessage ? (
              <Alert
                role="status"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              >
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            ) : null}

            {errorMessage ? (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="size-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting || isUnchanged}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
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
