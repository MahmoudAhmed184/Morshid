import { useState, useId, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
  updateAdminDeploymentDefaults,
  setAdminCourseOverride,
  deleteAdminCourseOverride,
} from '../allowances.api'
import {
  adminAllowancePoliciesQueryOptions,
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

  // Fetch policy defaults & overrides from the unified policies endpoint
  const policiesQuery = useQuery(adminAllowancePoliciesQueryOptions())
  const coursesQuery = useQuery(adminCoursesListQueryOptions())

  const courses = useMemo(
    () => coursesQuery.data?.courses ?? [],
    [coursesQuery.data?.courses],
  )
  const policies = policiesQuery.data
  const currentDefaultLimit = isTutoring
    ? (policies?.deploymentDefaults.tutoringLimit ?? 30)
    : (policies?.deploymentDefaults.reviewLimit ?? 3)

  // Editing Default State
  const [editingDefault, setEditingDefault] = useState(false)
  const [defaultInputValue, setDefaultInputValue] =
    useState<number>(currentDefaultLimit)
  const [defaultError, setDefaultError] = useState<string | null>(null)
  const [defaultSuccess, setDefaultSuccess] = useState<string | null>(null)

  // Add/Edit Override State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [overrideCourseId, setOverrideCourseId] = useState('')
  const [overrideLimit, setOverrideLimit] =
    useState<number>(currentDefaultLimit)
  const [overrideError, setOverrideError] = useState<string | null>(null)

  // Reset Allowance Dialog State
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(
    null,
  )

  // Update default mutation
  const updateDefaultMutation = useMutation({
    mutationFn: (newLimit: number) =>
      updateAdminDeploymentDefaults(
        isTutoring ? { tutoringLimit: newLimit } : { reviewLimit: newLimit },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminPolicies(),
      })
      setEditingDefault(false)
      setDefaultError(null)
      setDefaultSuccess('Deployment default limit updated successfully.')
    },
    onError: (err: Error) => {
      setDefaultError(err.message || 'Failed to update policy default.')
    },
  })

  // Set override mutation
  const setOverrideMutation = useMutation({
    mutationFn: () =>
      setAdminCourseOverride(
        overrideCourseId,
        isTutoring
          ? { tutoringLimit: overrideLimit }
          : { reviewLimit: overrideLimit },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminPolicies(),
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
    mutationFn: (courseId: string) => deleteAdminCourseOverride(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allowancesKeys.adminPolicies(),
      })
    },
  })

  const handleSaveDefault = () => {
    if (defaultInputValue < minLimit || defaultInputValue > maxLimit) {
      setDefaultError(`Limit must be between ${minLimit} and ${maxLimit}.`)
      return
    }
    setDefaultSuccess(null)
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

  const courseSelectItems = useMemo(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })),
    [courses],
  )

  const relevantOverrides = useMemo(() => {
    const allOverrides = policies?.courseOverrides ?? []
    return allOverrides.filter((o) =>
      isTutoring
        ? o.tutoringLimit !== null && o.tutoringLimit !== undefined
        : o.reviewLimit !== null && o.reviewLimit !== undefined,
    )
  }, [policies, isTutoring])

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          {/* Header row with Reset Student Allowance action */}
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
              Reset Student Allowance
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <p className="leading-relaxed">
                {isTutoring
                  ? 'Configure deployment-wide default tutoring turns and per-course overrides for student AI tutoring. Allowance limits automatically reset daily at midnight (Africa/Cairo).'
                  : 'Configure deployment-wide default manual review limits and per-course overrides. Instructor bounded automatic triggers do not consume student allowances.'}
              </p>
            </div>
          </div>

          {defaultSuccess && (
            <Alert className="border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription>{defaultSuccess}</AlertDescription>
            </Alert>
          )}

          {resetSuccessMessage && (
            <Alert className="border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription>{resetSuccessMessage}</AlertDescription>
            </Alert>
          )}

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

              {policiesQuery.isLoading ? (
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
                      {updateDefaultMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 size-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
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
                  <Badge
                    variant="secondary"
                    className="text-xs font-semibold px-2.5 py-1"
                  >
                    {currentDefaultLimit} / day
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDefaultInputValue(currentDefaultLimit)
                      setDefaultSuccess(null)
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

            {policiesQuery.isLoading ? (
              <Skeleton className="h-28 w-full rounded-xl" />
            ) : relevantOverrides.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                No course overrides configured. All courses follow the
                deployment default limit ({currentDefaultLimit}).
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border/80 bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium">
                        Course
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Override Limit
                      </TableHead>
                      <TableHead className="text-xs font-medium">
                        Last Updated
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relevantOverrides.map((override) => {
                      const course = courses.find(
                        (c) => c.id === override.courseId,
                      )
                      const courseName = course
                        ? `${course.code} — ${course.title}`
                        : override.courseCode
                          ? `${override.courseCode} — ${override.courseTitle ?? ''}`
                          : override.courseId
                      const limitValue = isTutoring
                        ? override.tutoringLimit
                        : override.reviewLimit

                      return (
                        <TableRow key={override.id}>
                          <TableCell className="text-sm font-medium text-foreground">
                            {courseName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {limitValue} / day
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
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{overrideError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor={overrideCourseSelectId}
                className="text-xs font-medium"
              >
                Course
              </Label>
              <Select
                value={overrideCourseId}
                items={courseSelectItems}
                onValueChange={(value) => {
                  if (value) setOverrideCourseId(value)
                }}
              >
                <SelectTrigger
                  id={overrideCourseSelectId}
                  aria-label="Select course"
                  className="w-full"
                >
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courseSelectItems.map((course) => (
                    <SelectItem key={course.value} value={course.value}>
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor={overrideLimitInputId}
                className="text-xs font-medium"
              >
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
              {setOverrideMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Override'
              )}
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
        onSuccess={() => {
          setResetSuccessMessage(
            'Student allowance has been reset successfully.',
          )
        }}
      />
    </div>
  )
}
