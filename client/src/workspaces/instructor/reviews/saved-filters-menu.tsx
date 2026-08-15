import { useState } from 'react'
import {
  BookmarkIcon,
  CheckIcon,
  PlusIcon,
  Trash2Icon,
  Edit2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { SaveFilterDialog } from './save-filter-dialog'
import { RenameFilterDialog } from './rename-filter-dialog'
import type {
  QueueFilterCriteria,
  SavedQueueFilter,
} from '../preferences/instructor-workspace-preferences.types'
import { MAX_SAVED_FILTERS } from '../preferences/instructor-workspace-preferences.storage'
import { studentFlagReasonLabel } from '@/features/reviews/interface/student-flag-reason'

export interface SavedFiltersMenuProps {
  currentCriteria: QueueFilterCriteria
  savedFilters: SavedQueueFilter[]
  courses: readonly { id: string; code: string; title: string }[]
  onApplyFilter: (filter: SavedQueueFilter) => void
  onSaveFilter: (name: string) => { success: boolean; error?: string }
  onRenameFilter: (
    id: string,
    newName: string,
  ) => { success: boolean; error?: string }
  onDeleteFilter: (id: string) => void
}

export function SavedFiltersMenu({
  currentCriteria,
  savedFilters,
  courses,
  onApplyFilter,
  onSaveFilter,
  onRenameFilter,
  onDeleteFilter,
}: SavedFiltersMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [filterToRename, setFilterToRename] = useState<SavedQueueFilter | null>(
    null,
  )
  const [filterToDelete, setFilterToDelete] = useState<SavedQueueFilter | null>(
    null,
  )

  const isAtLimit = savedFilters.length >= MAX_SAVED_FILTERS

  const formatCriteriaSummary = (criteria: QueueFilterCriteria): string => {
    const parts: string[] = []
    if (criteria.status && criteria.status !== 'ALL') {
      parts.push(criteria.status.toLowerCase().replace('_', ' '))
    }
    if (criteria.courseId) {
      const course = courses.find((c) => c.id === criteria.courseId)
      if (course) parts.push(course.code)
    }
    if (criteria.trigger) {
      parts.push(criteria.trigger.toLowerCase().replace(/_/g, ' '))
    }
    if (criteria.studentFlagReason) {
      parts.push(studentFlagReasonLabel(criteria.studentFlagReason))
    }
    if (criteria.search) {
      parts.push(`"${criteria.search}"`)
    }
    return parts.length > 0 ? parts.join(' · ') : 'All reviews'
  }

  const isFilterActive = (filter: SavedQueueFilter): boolean => {
    const fc = filter.criteria
    const cc = currentCriteria
    return (
      (fc.status ?? 'ALL') === (cc.status ?? 'ALL') &&
      (fc.courseId ?? null) === (cc.courseId ?? null) &&
      (fc.trigger ?? null) === (cc.trigger ?? null) &&
      (fc.studentFlagReason ?? null) === (cc.studentFlagReason ?? null) &&
      (fc.search ?? '') === (cc.search ?? '')
    )
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium"
              aria-label={`Saved filter presets (${savedFilters.length} saved)`}
            >
              <BookmarkIcon className="size-3.5 text-primary" aria-hidden />
              <span>Presets</span>
              {savedFilters.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[0.65rem] font-semibold text-primary">
                  {savedFilters.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setSaveOpen(true)}
              disabled={isAtLimit}
              className="cursor-pointer gap-2"
            >
              <PlusIcon className="size-4 text-primary" aria-hidden />
              <span>Save current filter as preset</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Saved presets</span>
              <span>
                {savedFilters.length}/{MAX_SAVED_FILTERS}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          {savedFilters.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No saved presets yet. Filter the queue and click "Save current
              filter" to add one.
            </div>
          ) : (
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {savedFilters.map((filter) => {
                const active = isFilterActive(filter)
                return (
                  <div
                    key={filter.id}
                    className="group relative flex items-center justify-between rounded-md px-1 hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() => onApplyFilter(filter)}
                      className="flex flex-1 flex-col items-start px-2 py-1.5 text-left outline-none"
                    >
                      <div className="flex w-full items-center gap-1.5">
                        <span
                          className={`text-xs font-medium ${
                            active
                              ? 'text-primary font-semibold'
                              : 'text-foreground'
                          }`}
                        >
                          {filter.name}
                        </span>
                        {active ? (
                          <CheckIcon
                            className="size-3 text-primary shrink-0"
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <span className="line-clamp-1 text-[0.7rem] text-muted-foreground">
                        {formatCriteriaSummary(filter.criteria)}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-80 group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        aria-label={`Rename preset ${filter.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFilterToRename(filter)
                        }}
                      >
                        <Edit2Icon className="size-3" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete preset ${filter.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFilterToDelete(filter)
                        }}
                      >
                        <Trash2Icon className="size-3" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Filter Dialog */}
      <SaveFilterDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        currentCriteria={currentCriteria}
        courses={courses}
        onSave={onSaveFilter}
        isAtLimit={isAtLimit}
      />

      {/* Rename Filter Dialog */}
      <RenameFilterDialog
        open={Boolean(filterToRename)}
        onOpenChange={(open) => {
          if (!open) setFilterToRename(null)
        }}
        filter={filterToRename}
        onRename={onRenameFilter}
      />

      {/* Delete Filter Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(filterToDelete)}
        onOpenChange={(open) => {
          if (!open) setFilterToDelete(null)
        }}
        title={`Delete "${filterToDelete?.name}"?`}
        description="This will remove this saved preset from this device. The queue review cases will not be affected."
        confirmLabel="Delete preset"
        destructive
        onConfirm={() => {
          if (filterToDelete) {
            onDeleteFilter(filterToDelete.id)
            setFilterToDelete(null)
          }
        }}
      />
    </>
  )
}
