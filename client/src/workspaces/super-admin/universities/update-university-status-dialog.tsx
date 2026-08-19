import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import type {
  UniversityItem,
  UniversityStatus,
} from '@/features/universities/universities.schema'
import { useUniversityMutations } from './use-universities'

type UpdateUniversityStatusDialogProps = {
  university: UniversityItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_OPTIONS: Array<{ value: UniversityStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

export function UpdateUniversityStatusDialog({
  university,
  open,
  onOpenChange,
}: UpdateUniversityStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<UniversityStatus>(
    university?.status ?? 'ACTIVE',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { updateUniversityStatus } = useUniversityMutations()

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setErrorMessage(null)
    } else if (university) {
      setSelectedStatus(university.status)
    }
  }

  if (!university) {
    return null
  }

  const handleSubmit = async () => {
    setErrorMessage(null)

    try {
      await updateUniversityStatus.mutateAsync({
        universityId: university.id,
        status: selectedStatus,
      })
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        isApiError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to update university status.',
      )
    }
  }

  const isPending = updateUniversityStatus.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update University Status</DialogTitle>
          <DialogDescription>
            Change lifecycle status for{' '}
            <strong className="font-semibold text-foreground">
              {university.name}
            </strong>{' '}
            ({university.code}).
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Current Status
            </span>
            <StatusBadge status={university.status} />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="new-status-select"
              className="text-xs font-medium text-foreground"
            >
              New Status
            </label>
            <Select
              items={STATUS_OPTIONS}
              value={selectedStatus}
              onValueChange={(val) =>
                setSelectedStatus(val as UniversityStatus)
              }
            >
              <SelectTrigger id="new-status-select">
                <SelectValue placeholder="Select status">
                  {(val) =>
                    STATUS_OPTIONS.find((opt) => opt.value === val)?.label ??
                    'Select status'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStatus === 'SUSPENDED' ? (
            <Alert variant="destructive" className="border-destructive/40">
              <ShieldAlert className="size-4" aria-hidden />
              <AlertDescription className="text-xs">
                Suspending this university immediately blocks all
                administrators, instructors, and students from signing in and
                accessing tenant courses and sessions.
              </AlertDescription>
            </Alert>
          ) : selectedStatus === 'INACTIVE' ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTriangle
                className="size-4 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <AlertDescription className="text-xs">
                Setting status to Inactive will temporarily prevent tenant users
                from signing in until reactivated.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2
                className="size-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <AlertDescription className="text-xs">
                Activating this university enables normal access for all active
                tenant users.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || selectedStatus === university.status}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Updating...
              </>
            ) : (
              'Save Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
