import { useState } from 'react'
import { BookmarkIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { studentFlagReasonLabel } from '@/features/reviews/interface/student-flag-reason'
import type { QueueFilterCriteria } from '../preferences/instructor-workspace-preferences.types'
import { MAX_FILTER_NAME_LENGTH } from '../preferences/instructor-workspace-preferences.storage'

export interface SaveFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentCriteria: QueueFilterCriteria
  courses: readonly { id: string; code: string; title: string }[]
  onSave: (name: string) => { success: boolean; error?: string }
  isAtLimit?: boolean
}

export function SaveFilterDialog({
  open,
  onOpenChange,
  currentCriteria,
  courses,
  onSave,
  isAtLimit = false,
}: SaveFilterDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const courseMatch = courses.find((c) => c.id === currentCriteria.courseId)
  const trimmedName = name.trim()
  const charCount = trimmedName.length
  const isOverLimit = charCount > MAX_FILTER_NAME_LENGTH

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isAtLimit) {
      setError('Limit reached. Delete an existing filter to save a new one.')
      return
    }

    if (charCount === 0) {
      setError('Filter name cannot be empty.')
      return
    }

    if (isOverLimit) {
      setError(
        `Filter name cannot exceed ${MAX_FILTER_NAME_LENGTH} characters.`,
      )
      return
    }

    const result = onSave(trimmedName)
    if (!result.success) {
      setError(result.error ?? 'Unable to save filter.')
      return
    }

    setName('')
    setError(null)
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setName('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkIcon className="size-4 text-primary" aria-hidden />
              Save Queue Filter
            </DialogTitle>
            <DialogDescription>
              Save current filter settings as a named preset to quickly apply
              later.
            </DialogDescription>
          </DialogHeader>

          {/* Active criteria preview */}
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filter preview
            </span>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {currentCriteria.status && currentCriteria.status !== 'ALL' ? (
                <Badge variant="secondary" className="text-xs">
                  Status: {currentCriteria.status}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Status: All
                </Badge>
              )}

              {courseMatch ? (
                <Badge variant="secondary" className="text-xs">
                  Course: {courseMatch.code}
                </Badge>
              ) : null}

              {currentCriteria.trigger ? (
                <Badge variant="info" className="text-xs">
                  Trigger: {currentCriteria.trigger}
                </Badge>
              ) : null}

              {currentCriteria.studentFlagReason ? (
                <Badge variant="outline" className="text-xs">
                  Reason:{' '}
                  {studentFlagReasonLabel(currentCriteria.studentFlagReason)}
                </Badge>
              ) : null}

              {currentCriteria.search ? (
                <Badge variant="outline" className="text-xs truncate max-w-40">
                  Search: "{currentCriteria.search}"
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="filter-preset-name">Preset name</Label>
              <span
                className={`text-xs ${
                  isOverLimit
                    ? 'font-bold text-destructive'
                    : 'text-muted-foreground'
                }`}
                aria-live="polite"
              >
                {charCount} / {MAX_FILTER_NAME_LENGTH}
              </span>
            </div>
            <Input
              id="filter-preset-name"
              placeholder="e.g., Pending CS-201 Bugs"
              value={name}
              maxLength={MAX_FILTER_NAME_LENGTH + 10}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              autoFocus
              aria-invalid={Boolean(error) || isOverLimit}
              aria-describedby={error ? 'filter-name-error' : undefined}
            />
            {error ? (
              <p
                id="filter-name-error"
                role="alert"
                className="flex items-center gap-1.5 text-xs text-destructive"
              >
                <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isAtLimit || charCount === 0 || isOverLimit}
            >
              Save preset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
