import { useState, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Skeleton } from '@/components/ui/skeleton'
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isTutoring ? 'Tutoring Usage Policy' : 'Review Request Policy'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isTutoring
              ? 'Configure deployment-wide default tutoring turns and per-course overrides.'
              : 'Configure deployment-wide default manual review limits and per-course overrides.'}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setResetDialogOpen(true)}
          data-testid="reset-allowance-trigger"
        >
          Reset Student Quota
        </Button>
      </div>

      {/* Deployment Default Card */}
      <Card data-testid="policy-default-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Deployment Default Limit
              </CardTitle>
              <CardDescription>
                Applied to all courses without an explicit override (
                {scopeLabel} per Policy Day).
              </CardDescription>
            </div>
            {!editingDefault && (
              <Badge variant="secondary" className="text-sm font-semibold">
                {currentDefaultLimit} / day
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {defaultsQuery.isLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : editingDefault ? (
            <div className="space-y-4">
              {defaultError && (
                <div className="text-sm text-destructive">{defaultError}</div>
              )}
              <div className="flex items-center gap-4">
                <div className="w-32">
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
                  />
                </div>
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
              <p className="text-xs text-muted-foreground">
                Allowed range: {minLimit} to {maxLimit}{' '}
                {scopeLabel.toLowerCase()}.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Current limit:{' '}
                <span className="font-semibold text-foreground">
                  {currentDefaultLimit}
                </span>{' '}
                {scopeLabel.toLowerCase()}
              </span>
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
        </CardContent>
      </Card>

      {/* Course Overrides Card */}
      <Card data-testid="course-overrides-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Course Policy Overrides
            </CardTitle>
            <CardDescription>
              Custom daily allowance limits tailored to specific courses.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setOverrideCourseId(courses[0]?.id || '')
              setOverrideLimit(currentDefaultLimit)
              setOverrideError(null)
              setOverrideModalOpen(true)
            }}
          >
            Add Override
          </Button>
        </CardHeader>
        <CardContent>
          {overridesQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : overrides.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No course overrides configured. All courses follow the deployment
              default limit ({currentDefaultLimit}).
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Override Limit</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override) => {
                  const course = courses.find((c) => c.id === override.courseId)
                  return (
                    <TableRow key={override.id}>
                      <TableCell className="font-medium">
                        {course
                          ? `${course.code} — ${course.title}`
                          : override.courseId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {override.overrideLimit} / day
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(override.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            deleteOverrideMutation.mutate(override.courseId)
                          }
                          disabled={deleteOverrideMutation.isPending}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
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

          <div className="space-y-4 py-4">
            {overrideError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {overrideError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={overrideCourseSelectId}>Course</Label>
              <Select
                value={overrideCourseId}
                onValueChange={(value) => setOverrideCourseId(value ?? '')}
              >
                <SelectTrigger
                  id={overrideCourseSelectId}
                  aria-label="Select course"
                >
                  <SelectValue placeholder="Select course" />
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

            <div className="space-y-2">
              <Label htmlFor={overrideLimitInputId}>
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
