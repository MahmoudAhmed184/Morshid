import { useState } from 'react'
import {
  BookmarkIcon,
  Edit2Icon,
  GraduationCapIcon,
  Trash2Icon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { EmptyState } from '@/components/ui/custom/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RenameFilterDialog } from '@/workspaces/instructor/reviews/rename-filter-dialog'
import { useCourseMembership } from '@/workspaces/instructor/use-course-membership'
import { useInstructorWorkspacePreferences } from '@/workspaces/instructor/preferences/use-instructor-workspace-preferences'
import { MAX_SAVED_FILTERS } from '@/workspaces/instructor/preferences/instructor-workspace-preferences.storage'
import type {
  QueueFilterCriteria,
  SavedQueueFilter,
} from '@/workspaces/instructor/preferences/instructor-workspace-preferences.types'
import { studentFlagReasonLabel } from '@/features/reviews/interface/student-flag-reason'

export function InstructorWorkspaceSettingsPage() {
  const { data: courses = [], isPending } = useCourseMembership()
  const {
    activeCourseId,
    setActiveCourseId,
    savedFilters,
    renameFilter,
    deleteFilter,
  } = useInstructorWorkspacePreferences()

  const [filterToRename, setFilterToRename] = useState<SavedQueueFilter | null>(
    null,
  )
  const [filterToDelete, setFilterToDelete] = useState<SavedQueueFilter | null>(
    null,
  )

  const formatFilterSummary = (criteria: QueueFilterCriteria) => {
    const badges: {
      key: string
      label: string
      variant?: 'default' | 'secondary' | 'outline' | 'info'
    }[] = []

    if (criteria.status && criteria.status !== 'ALL') {
      badges.push({
        key: 'status',
        label: `Status: ${criteria.status}`,
        variant: 'secondary',
      })
    } else {
      badges.push({
        key: 'status',
        label: 'Status: All',
        variant: 'outline',
      })
    }

    if (criteria.courseId) {
      const course = courses.find((c) => c.id === criteria.courseId)
      if (course) {
        badges.push({
          key: 'course',
          label: `Course: ${course.code}`,
          variant: 'secondary',
        })
      }
    }

    if (criteria.trigger) {
      badges.push({
        key: 'trigger',
        label: `Trigger: ${criteria.trigger}`,
        variant: 'info',
      })
    }

    if (criteria.studentFlagReason) {
      badges.push({
        key: 'reason',
        label: `Reason: ${studentFlagReasonLabel(criteria.studentFlagReason)}`,
        variant: 'outline',
      })
    }

    if (criteria.search) {
      badges.push({
        key: 'search',
        label: `"${criteria.search}"`,
        variant: 'outline',
      })
    }

    return badges
  }

  const courseSelectItems = [
    { label: 'Auto (First assigned course)', value: 'auto' },
    ...courses.map((course) => ({
      label: `${course.code} — ${course.title}`,
      value: course.id,
    })),
  ]

  const currentSelectValue = activeCourseId ?? 'auto'

  return (
    <div className="flex flex-col gap-6">
      {/* Preferred Course Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCapIcon className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-base font-semibold">
              Default Active Course
            </CardTitle>
          </div>
          <CardDescription>
            Choose the course to open automatically when you navigate to the
            instructor dashboard and course materials on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:max-w-md">
            <Select
              value={currentSelectValue}
              items={courseSelectItems}
              disabled={isPending || courses.length === 0}
              onValueChange={(val) => {
                if (val === 'auto' || !val) {
                  setActiveCourseId(null)
                } else {
                  setActiveCourseId(val)
                }
              }}
            >
              <SelectTrigger aria-label="Select default active course">
                <SelectValue placeholder="Choose default course" />
              </SelectTrigger>
              <SelectContent>
                {courseSelectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {courses.length === 0 && !isPending ? (
              <p className="text-xs text-muted-foreground">
                You are not currently assigned to any courses.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Saved Filters Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookmarkIcon className="size-5 text-primary" aria-hidden />
              <CardTitle className="text-base font-semibold">
                Saved Review Queue Presets
              </CardTitle>
            </div>
            <CardDescription className="mt-1">
              Filter configurations saved on this browser for quick review
              access.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {savedFilters.length} / {MAX_SAVED_FILTERS} presets
          </Badge>
        </CardHeader>
        <CardContent>
          {savedFilters.length === 0 ? (
            <EmptyState
              icon={<BookmarkIcon aria-hidden />}
              title="No saved presets yet"
              description="Configure filters in the Review Queue and save them as presets to access them here."
              className="min-h-36 py-6"
            />
          ) : (
            <div className="divide-y rounded-xl border">
              {savedFilters.map((filter) => {
                const badges = formatFilterSummary(filter.criteria)
                return (
                  <div
                    key={filter.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-muted/20"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {filter.name}
                        </span>
                        {filter.updatedAt ? (
                          <span className="text-[0.7rem] text-muted-foreground">
                            (edited)
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {badges.map((b) => (
                          <Badge
                            key={b.key}
                            variant={b.variant ?? 'secondary'}
                            className="text-[0.7rem] font-normal"
                          >
                            {b.label}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setFilterToRename(filter)}
                        aria-label={`Rename ${filter.name}`}
                      >
                        <Edit2Icon className="size-3.5" aria-hidden />
                        <span>Rename</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setFilterToDelete(filter)}
                        aria-label={`Delete ${filter.name}`}
                      >
                        <Trash2Icon className="size-3.5" aria-hidden />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <RenameFilterDialog
        open={Boolean(filterToRename)}
        onOpenChange={(open) => {
          if (!open) setFilterToRename(null)
        }}
        filter={filterToRename}
        onRename={renameFilter}
      />

      {/* Delete Dialog */}
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
            deleteFilter(filterToDelete.id)
            setFilterToDelete(null)
          }
        }}
      />
    </div>
  )
}
