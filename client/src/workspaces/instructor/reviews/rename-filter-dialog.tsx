import { useState } from 'react'
import { Edit3Icon, TriangleAlertIcon } from 'lucide-react'

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
import type { SavedQueueFilter } from '../preferences/instructor-workspace-preferences.types'
import { MAX_FILTER_NAME_LENGTH } from '../preferences/instructor-workspace-preferences.storage'

export interface RenameFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filter: SavedQueueFilter | null
  onRename: (
    filterId: string,
    newName: string,
  ) => { success: boolean; error?: string }
}

export function RenameFilterDialog({
  open,
  onOpenChange,
  filter,
  onRename,
}: RenameFilterDialogProps) {
  const [prevFilter, setPrevFilter] = useState(filter)
  const [name, setName] = useState(filter?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  if (filter !== prevFilter) {
    setPrevFilter(filter)
    setName(filter?.name ?? '')
    setError(null)
  }

  const trimmedName = name.trim()
  const charCount = trimmedName.length
  const isOverLimit = charCount > MAX_FILTER_NAME_LENGTH

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!filter) return

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

    const result = onRename(filter.id, trimmedName)
    if (!result.success) {
      setError(result.error ?? 'Unable to rename filter.')
      return
    }

    setError(null)
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
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
              <Edit3Icon className="size-4 text-primary" aria-hidden />
              Rename Filter Preset
            </DialogTitle>
            <DialogDescription>
              Choose a new unique name for this review queue filter preset.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rename-filter-input">Preset name</Label>
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
              id="rename-filter-input"
              placeholder="Filter preset name"
              value={name}
              maxLength={MAX_FILTER_NAME_LENGTH + 10}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              autoFocus
              aria-invalid={Boolean(error) || isOverLimit}
              aria-describedby={error ? 'rename-error' : undefined}
            />
            {error ? (
              <p
                id="rename-error"
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
            <Button type="submit" disabled={charCount === 0 || isOverLimit}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
