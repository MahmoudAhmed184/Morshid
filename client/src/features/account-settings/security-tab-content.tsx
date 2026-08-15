import type { FormEvent } from 'react'
import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { changePasswordApi } from '@/features/auth/session/interface/account-password'

export function SecurityTabContent() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentPassword) {
      setSuccessMessage(null)
      setErrorMessage('Current password is required.')
      return
    }

    if (newPassword.length < 15) {
      setSuccessMessage(null)
      setErrorMessage('New password must be at least 15 characters.')
      return
    }

    if (newPassword.length > 128) {
      setSuccessMessage(null)
      setErrorMessage('New password must not exceed 128 characters.')
      return
    }

    if (newPassword !== confirmation) {
      setSuccessMessage(null)
      setErrorMessage('New password and confirmation do not match.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

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
      setSuccessMessage(
        'Password changed successfully. Your session has been updated.',
      )
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unable to change password. Please try again.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormIncomplete =
    !currentPassword || !newPassword || !confirmation || isSubmitting

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

          <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-2">
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
                    if (successMessage || errorMessage) {
                      setSuccessMessage(null)
                      setErrorMessage(null)
                    }
                  }}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                    if (successMessage || errorMessage) {
                      setSuccessMessage(null)
                      setErrorMessage(null)
                    }
                  }}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                    if (successMessage || errorMessage) {
                      setSuccessMessage(null)
                      setErrorMessage(null)
                    }
                  }}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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

            {errorMessage && (
              <Alert
                variant="destructive"
                className="border-destructive/40 text-destructive dark:border-destructive"
              >
                <AlertCircle className="size-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="border-emerald-500/30 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="submit"
                disabled={isFormIncomplete}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
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
    </div>
  )
}
