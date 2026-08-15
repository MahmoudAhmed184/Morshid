import { useState } from 'react'
import {
  Globe,
  Laptop,
  Loader2,
  Monitor,
  Smartphone,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import type { ActiveSession } from './active-sessions.types'

interface ActiveSessionItemProps {
  session: ActiveSession
  onRevoke: (sessionId: string) => Promise<void>
}

export function ActiveSessionItem({
  session,
  onRevoke,
}: ActiveSessionItemProps) {
  const [isRevoking, setIsRevoking] = useState(false)

  async function handleRevokeConfirm() {
    setIsRevoking(true)
    try {
      await onRevoke(session.id)
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div
      data-testid={`session-item-${session.id}`}
      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-4 text-card-foreground shadow-2xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {renderDeviceIcon(session.device)}
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {session.device}
            </span>
            {session.isCurrent ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              >
                Current session
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {session.ip ? (
              <span className="flex items-center gap-1">
                <Globe className="size-3" aria-hidden />
                {session.ip}
              </span>
            ) : null}
            <span>Signed in {formatSessionDate(session.createdAt)}</span>
            <span>•</span>
            <span>Last active {formatSessionDate(session.lastActiveAt)}</span>
          </div>
        </div>
      </div>

      {!session.isCurrent ? (
        <div className="flex justify-end pt-2 sm:pt-0">
          <ConfirmDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                disabled={isRevoking}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isRevoking ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                )}
                Revoke
              </Button>
            }
            title="Revoke active session?"
            description={`This will immediately sign out ${session.device} and invalidate its access.`}
            confirmLabel="Revoke session"
            destructive
            onConfirm={handleRevokeConfirm}
          />
        </div>
      ) : null}
    </div>
  )
}

function renderDeviceIcon(device: string) {
  const lower = device.toLowerCase()
  if (
    lower.includes('ios') ||
    lower.includes('android') ||
    lower.includes('mobile')
  ) {
    return <Smartphone className="size-5" aria-hidden />
  }
  if (
    lower.includes('mac') ||
    lower.includes('windows') ||
    lower.includes('linux') ||
    lower.includes('chromeos')
  ) {
    return <Laptop className="size-5" aria-hidden />
  }
  return <Monitor className="size-5" aria-hidden />
}

function formatSessionDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return isoString
  }
}
