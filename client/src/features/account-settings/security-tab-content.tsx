import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { changePasswordApi } from '@/features/auth/session/interface/account-password'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import {
  fetchActiveSessions,
  revokeActiveSession,
  revokeOtherActiveSessions,
} from './active-sessions/active-sessions.api'
import { ActiveSessionItem } from './active-sessions/active-session-item'
import type { ActiveSession } from './active-sessions/active-sessions.types'

export function SecurityTabContent() {
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<
    string | null
  >(null)
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<
    string | null
  >(null)

  // Active sessions state
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false)
  const [isRevokingAll, setIsRevokingAll] = useState(false)
  const [sessionsSuccessMessage, setSessionsSuccessMessage] = useState<
    string | null
  >(null)
  const [sessionsErrorMessage, setSessionsErrorMessage] = useState<
    string | null
  >(null)
  const [announcement, setAnnouncement] = useState<string>('')

  useEffect(() => {
    let active = true

    async function loadInitial() {
      try {
        const activeSessions = await fetchActiveSessions()
        if (active) {
          setSessions(activeSessions)
        }
      } catch (error) {
        if (active) {
          const message = isApiError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Unable to load active sessions. Please try again.'
          setSessionsErrorMessage(message)
        }
      } finally {
        if (active) {
          setIsLoadingSessions(false)
        }
      }
    }

    void loadInitial()

    return () => {
      active = false
    }
  }, [])

  async function handleRefreshSessions() {
    setIsRefreshingSessions(true)
    setSessionsErrorMessage(null)

    try {
      const activeSessions = await fetchActiveSessions()
      setSessions(activeSessions)
      setAnnouncement('Active sessions list refreshed.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to load active sessions. Please try again.'
      setSessionsErrorMessage(message)
    } finally {
      setIsRefreshingSessions(false)
    }
  }

  async function handleRetrySessions() {
    setIsLoadingSessions(true)
    setSessionsErrorMessage(null)

    try {
      const activeSessions = await fetchActiveSessions()
      setSessions(activeSessions)
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to load active sessions. Please try again.'
      setSessionsErrorMessage(message)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  async function handleRevokeSingleSession(sessionId: string) {
    setSessionsErrorMessage(null)
    setSessionsSuccessMessage(null)

    try {
      await revokeActiveSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setSessionsSuccessMessage('Session revoked successfully.')
      setAnnouncement('Session revoked successfully.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to revoke session. Please try again.'
      setSessionsErrorMessage(message)
      throw error
    }
  }

  async function handleRevokeAllOtherSessions() {
    setSessionsErrorMessage(null)
    setSessionsSuccessMessage(null)
    setIsRevokingAll(true)

    try {
      await revokeOtherActiveSessions()
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      setSessionsSuccessMessage(
        'All other active sessions have been signed out.',
      )
      setAnnouncement('All other active sessions have been signed out.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to revoke other sessions. Please try again.'
      setSessionsErrorMessage(message)
      throw error
    } finally {
      setIsRevokingAll(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentPassword) {
      setPasswordSuccessMessage(null)
      setPasswordErrorMessage('Current password is required.')
      return
    }

    if (newPassword.length < 15) {
      setPasswordSuccessMessage(null)
      setPasswordErrorMessage('New password must be at least 15 characters.')
      return
    }

    if (newPassword.length > 128) {
      setPasswordSuccessMessage(null)
      setPasswordErrorMessage('New password must not exceed 128 characters.')
      return
    }

    if (newPassword !== confirmation) {
      setPasswordSuccessMessage(null)
      setPasswordErrorMessage('New password and confirmation do not match.')
      return
    }

    setIsSubmittingPassword(true)
    setPasswordErrorMessage(null)
    setPasswordSuccessMessage(null)

    try {
      const session = await changePasswordApi({
        currentPassword,
        newPassword,
        confirmation,
      })

      useAuthStore.getState().setSession(session)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setPasswordSuccessMessage(
        'Password changed successfully. Your session has been updated.',
      )
      // Also refresh active sessions list since remote sessions were revoked
      void handleRefreshSessions()
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to change password. Please try again.'
      setPasswordErrorMessage(message)
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const isPasswordFormIncomplete =
    !currentPassword ||
    !newPassword ||
    !confirmation ||
    isSubmittingPassword

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <div className="space-y-6">
      {/* Screen reader live region */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Change Password Card */}
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              Change Password
            </h2>
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <p className="leading-relaxed">
                Choose a strong passphrase with at least 15 characters. Changing
                your password will immediately revoke all other active sessions
                on other devices and continue this browser session securely.
              </p>
            </div>
          </div>

          <form
            onSubmit={handlePasswordSubmit}
            noValidate
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  name="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    if (passwordSuccessMessage || passwordErrorMessage) {
                      setPasswordSuccessMessage(null)
                      setPasswordErrorMessage(null)
                    }
                  }}
                  disabled={isSubmittingPassword}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent(!showCurrent)}
                  disabled={isSubmittingPassword}
                  aria-label={
                    showCurrent
                      ? 'Hide current password'
                      : 'Show current password'
                  }
                >
                  {showCurrent ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  name="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (passwordSuccessMessage || passwordErrorMessage) {
                      setPasswordSuccessMessage(null)
                      setPasswordErrorMessage(null)
                    }
                  }}
                  disabled={isSubmittingPassword}
                  placeholder="Enter at least 15 characters"
                  autoComplete="new-password"
                  minLength={15}
                  maxLength={128}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(!showNew)}
                  disabled={isSubmittingPassword}
                  aria-label={
                    showNew ? 'Hide new password' : 'Show new password'
                  }
                >
                  {showNew ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 15 characters. Passphrases, spaces, and Unicode
                are supported.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="confirmation"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(e) => {
                    setConfirmation(e.target.value)
                    if (passwordSuccessMessage || passwordErrorMessage) {
                      setPasswordSuccessMessage(null)
                      setPasswordErrorMessage(null)
                    }
                  }}
                  disabled={isSubmittingPassword}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                  disabled={isSubmittingPassword}
                  aria-label={
                    showConfirm
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            {passwordErrorMessage && (
              <Alert
                variant="destructive"
                className="border-destructive/40 text-destructive dark:border-destructive"
              >
                <AlertCircle className="size-4" />
                <AlertDescription>{passwordErrorMessage}</AlertDescription>
              </Alert>
            )}

            {passwordSuccessMessage && (
              <Alert className="border-emerald-500/30 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                <AlertDescription>{passwordSuccessMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                disabled={isPasswordFormIncomplete}
                className="w-full sm:w-auto"
              >
                {isSubmittingPassword ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    Updating password...
                  </>
                ) : (
                  'Change password'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Active Sessions Card */}
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
                <ShieldCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Active Sessions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Devices and browsers currently signed in to your account.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefreshSessions()}
                disabled={isLoadingSessions || isRefreshingSessions}
                aria-label="Refresh active sessions"
              >
                <RotateCw
                  className={`mr-1.5 size-3.5 ${
                    isRefreshingSessions ? 'animate-spin' : ''
                  }`}
                  aria-hidden
                />
                Refresh
              </Button>

              {otherSessionsCount > 0 ? (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoadingSessions || isRevokingAll}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {isRevokingAll ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <LogOut className="mr-1.5 size-3.5" aria-hidden />
                      )}
                      Sign out all other sessions
                    </Button>
                  }
                  title="Sign out all other sessions?"
                  description={`This will immediately sign out ${otherSessionsCount} other active ${
                    otherSessionsCount === 1 ? 'device' : 'devices'
                  }. Your current session will remain signed in.`}
                  confirmLabel="Sign out other sessions"
                  destructive
                  onConfirm={handleRevokeAllOtherSessions}
                />
              ) : null}
            </div>
          </div>

          {sessionsSuccessMessage ? (
            <Alert
              role="status"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            >
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription>{sessionsSuccessMessage}</AlertDescription>
            </Alert>
          ) : null}

          {sessionsErrorMessage ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="size-4" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{sessionsErrorMessage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRetrySessions()}
                  className="h-7 text-xs"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {isLoadingSessions ? (
            <div
              data-testid="sessions-loading"
              className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground"
            >
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm">Loading active sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div
              data-testid="sessions-empty"
              className="rounded-lg border border-dashed border-border p-8 text-center"
            >
              <Laptop
                className="mx-auto size-8 text-muted-foreground/60"
                aria-hidden
              />
              <p className="mt-2 text-sm font-medium text-foreground">
                No active sessions found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign in to view your active devices here.
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="sessions-list">
              {sessions.map((session) => (
                <ActiveSessionItem
                  key={session.id}
                  session={session}
                  onRevoke={handleRevokeSingleSession}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
