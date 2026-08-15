import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
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
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import {
  fetchActiveSessions,
  revokeActiveSession,
  revokeOtherActiveSessions,
} from './active-sessions/active-sessions.api'
import { ActiveSessionItem } from './active-sessions/active-session-item'
import type { ActiveSession } from './active-sessions/active-sessions.types'

export function SecurityTabContent() {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRevokingAll, setIsRevokingAll] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
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
          setErrorMessage(message)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadInitial()

    return () => {
      active = false
    }
  }, [])

  async function handleRefresh() {
    setIsRefreshing(true)
    setErrorMessage(null)

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
      setErrorMessage(message)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleRetry() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const activeSessions = await fetchActiveSessions()
      setSessions(activeSessions)
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to load active sessions. Please try again.'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRevokeSingle(sessionId: string) {
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await revokeActiveSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setSuccessMessage('Session revoked successfully.')
      setAnnouncement('Session revoked successfully.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to revoke session. Please try again.'
      setErrorMessage(message)
      throw error
    }
  }

  async function handleRevokeAllOthers() {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsRevokingAll(true)

    try {
      await revokeOtherActiveSessions()
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      setSuccessMessage('All other active sessions have been signed out.')
      setAnnouncement('All other active sessions have been signed out.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to revoke other sessions. Please try again.'
      setErrorMessage(message)
      throw error
    } finally {
      setIsRevokingAll(false)
    }
  }

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <div className="space-y-4">
      {/* Screen reader live region */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

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
                onClick={() => void handleRefresh()}
                disabled={isLoading || isRefreshing}
                aria-label="Refresh active sessions"
              >
                <RotateCw
                  className={`mr-1.5 size-3.5 ${
                    isRefreshing ? 'animate-spin' : ''
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
                      disabled={isLoading || isRevokingAll}
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
                  onConfirm={handleRevokeAllOthers}
                />
              ) : null}
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
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{errorMessage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRetry()}
                  className="h-7 text-xs"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {isLoading ? (
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
                  onRevoke={handleRevokeSingle}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
