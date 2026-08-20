import { useState, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Gauge,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  updateAdminPolicyDefault,
  setAdminCourseOverride,
  deleteAdminCourseOverride,
} from '../allowances.api'
import {
  adminPolicyDefaultsQueryOptions,
  adminCourseOverridesQueryOptions,
  adminCoursesListQueryOptions,
  allowancesKeys,
} from '../allowances.queries'
import { AdminResetAllowanceDialog } from './admin-reset-allowance-dialog'

interface AdminAllowancePolicyPageProps {
  scope: 'TUTORING' | 'REVIEW'
}

export function AdminAllowancePolicyPage({
  scope,
}: AdminAllowancePolicyPageProps) {
  const queryClient = useQueryClient()
  const defaultLimitInputId = useId()
  const overrideCourseSelectId = useId()
  const overrideLimitInputId = useId()

  const isTutoring = scope === 'TUTORING'
  const minLimit = 0
  const maxLimit = isTutoring ? 500 : 20
  const scopeLabel = isTutoring ? 'Tutoring turns' : 'Review requests'
  const PageIcon = isTutoring ? Gauge : ShieldCheck

  // Fetch policy defaults & overrides
  const defaultsQuery = useQuery(adminPolicyDefaultsQueryOptions())
  const overridesQuery = useQuery(adminCourseOverridesQueryOptions(scope))
  const coursesQuery = useQuery(adminCoursesListQueryOptions())

  const courses = coursesQuery.data?.courses ?? []
  const currentDefaultObj = defaultsQuery.data?.find((d) => d.scope === scope)
  const currentDefaultLimit =
    currentDefaultObj?.defaultLimit ?? (isTutoring ? 30 : 3)

  // Editing Default State
  const [editingDefault, setEditingDefault] = useState(false)
  const [defaultInputValue, setDefaultInputValue] =
    useState<number>(currentDefaultLimit)
  const [defaultError, setDefaultError] = useState<string | null>(null)

  // Add/Edit Override State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [overrideCourseId, setOverrideCourseId] = useState('')
  const [overrideLimit, setOverrideLimit] =
    useState<number>(currentDefaultLimit)
  const [overrideError, setOverrideError] = useState<string | null>(null)

  // Reset Allowance Dialog State
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  // Update default mutation
  const updateDefaultMutation = useMutation({
    mutationFn: (newLimit: number) => updateAdminPolicyDefault(scope, newLimit),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminDefaults(),
      })
      setEditingDefault(false)
      setDefaultError(null)
    },
    onError: (err: Error) => {
      setDefaultError(err.message || 'Failed to update policy default.')
    },
  })

  // Set override mutation
  const setOverrideMutation = useMutation({
    mutationFn: () =>
      setAdminCourseOverride(overrideCourseId, scope, overrideLimit),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminOverrides(scope),
      })
      setOverrideModalOpen(false)
      setOverrideCourseId('')
      setOverrideError(null)
    },
    onError: (err: Error) => {
      setOverrideError(err.message || 'Failed to save course override.')
    },
  })

  // Delete override mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: (courseId: string) =>
      deleteAdminCourseOverride(courseId, scope),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminOverrides(scope),
      })
    },
  })

  const handleSaveDefault = () => {
    if (defaultInputValue < minLimit || defaultInputValue > maxLimit) {
      setDefaultError(`Limit must be between ${minLimit} and ${maxLimit}.`)
      return
    }
    updateDefaultMutation.mutate(defaultInputValue)
  }

  const handleSaveOverride = () => {
    if (!overrideCourseId) {
      setOverrideError('Please select a course.')
      return
    }
    if (overrideLimit < minLimit || overrideLimit > maxLimit) {
      setOverrideError(`Limit must be between ${minLimit} and ${maxLimit}.`)
      return
    }
    setOverrideMutation.mutate()
  }

  const overrides = overridesQuery.data ?? []
  const selectedOverrideCourse = courses.find((c) => c.id === overrideCourseId)

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          {/* Header row with Reset Student Quota action */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <PageIcon className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-medium text-foreground">
                {isTutoring ? 'Tutoring Usage Policy' : 'Review Request Policy'}
              </h2>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setResetDialogOpen(true)}
              data-testid="reset-allowance-trigger"
              className="gap-1.5 self-start sm:self-auto"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset Student Quota
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {isTutoring
              ? 'Configure deployment-wide default tutoring turns and per-course overrides for student AI tutoring.'
              : 'Configure deployment-wide default manual review limits and per-course overrides.'}
          </p>

          {/* Deployment Default Row */}
          <div
            data-testid="policy-default-card"
            className="border-t border-border/60 pt-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  Deployment Default Limit
                </h3>
                <p className="text-xs text-muted-foreground">
                  Applied to all courses without an explicit override (
                  {scopeLabel} per Policy Day).
                </p>
              </div>

              {defaultsQuery.isLoading ? (
                <Skeleton className="h-9 w-32" />
              ) : editingDefault ? (
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={defaultLimitInputId} className="sr-only">
                      Default Limit
                    </Label>
                    <Input
                      id={defaultLimitInputId}
                      type="number"
                      min={minLimit}
                      max={maxLimit}
                      value={defaultInputValue}
                      onChange={(e) =>
                        setDefaultInputValue(
                          Number.parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className="h-9 w-24 text-center"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveDefault}
                      disabled={updateDefaultMutation.isPending}
                    >
                      {updateDefaultMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingDefault(false)
                        setDefaultInputValue(currentDefaultLimit)
                        setDefaultError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {defaultError && (
                    <p className="text-xs text-destructive">{defaultError}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                    {currentDefaultLimit} / day
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDefaultInputValue(currentDefaultLimit)
                      setEditingDefault(true)
                    }}
                  >
                    Change Default
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Course Policy Overrides Section */}
          <div
            data-testid="course-overrides-card"
            className="border-t border-border/60 pt-5 space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  Course Policy Overrides
                </h3>
                <p className="text-xs text-muted-foreground">
                  Custom daily allowance limits tailored to specific courses.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setOverrideCourseId(courses[0]?.id || '')
                  setOverrideLimit(currentDefaultLimit)
                  setOverrideError(null)
                  setOverrideModalOpen(true)
                }}
                className="gap-1.5 self-start sm:self-auto"
              >
                <Plus className="size-3.5" aria-hidden />
                Add Override
              </Button>
            </div>

            {overridesQuery.isLoading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : overrides.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                No course overrides configured. All courses follow the deployment
                default limit ({currentDefaultLimit}).
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/80 bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium">Course</TableHead>
                      <TableHead className="text-xs font-medium">Override Limit</TableHead>
                      <TableHead className="text-xs font-medium">Last Updated</TableHead>
                      <TableHead className="text-right text-xs font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((override) => {
                      const course = courses.find(
                        (c) => c.id === override.courseId,
                      )
                      return (
                        <TableRow key={override.id}>
                          <TableCell className="text-sm font-medium text-foreground">
                            {course
                              ? `${course.code} — ${course.title}`
                              : override.courseId}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {override.overrideLimit} / day
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(override.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs"
                              onClick={() =>
                                deleteOverrideMutation.mutate(override.courseId)
                              }
                              disabled={deleteOverrideMutation.isPending}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Override Modal */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Course Policy Override</DialogTitle>
            <DialogDescription>
              Override the default daily {scopeLabel.toLowerCase()} for a
              specific course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {overrideError && (
              <div className="rounded-lg bg-destructive/15 p-3 text-xs text-destructive">
                {overrideError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={overrideCourseSelectId} className="text-xs font-medium">
                Course
              </Label>
              <Select
                value={overrideCourseId}
                onValueChange={(value) => setOverrideCourseId(value ?? '')}
              >
                <SelectTrigger
                  id={overrideCourseSelectId}
                  aria-label="Select course"
                  className="w-full"
                >
                  <SelectValue placeholder="Select course">
                    {selectedOverrideCourse
                      ? `${selectedOverrideCourse.code} — ${selectedOverrideCourse.title}`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} — {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={overrideLimitInputId} className="text-xs font-medium">
                Daily Limit ({scopeLabel})
              </Label>
              <Input
                id={overrideLimitInputId}
                type="number"
                min={minLimit}
                max={maxLimit}
                value={overrideLimit}
                onChange={(e) =>
                  setOverrideLimit(Number.parseInt(e.target.value, 10) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                Allowed range: {minLimit} to {maxLimit}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverrideModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveOverride}
              disabled={setOverrideMutation.isPending}
            >
              {setOverrideMutation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Student Allowance Dialog */}
      <AdminResetAllowanceDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        defaultScope={scope}
        courses={courses.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
        }))}
      />
    </div>
  )
}
