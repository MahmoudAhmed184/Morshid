import { useState, useId } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminResetAllowance } from '../allowances.api'
import { allowancesKeys } from '../allowances.queries'

interface AdminResetAllowanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultScope?: 'TUTORING' | 'REVIEW'
  courses?: Array<{ id: string; code: string; title: string }>
  onSuccess?: () => void
}

export function AdminResetAllowanceDialog({
  open,
  onOpenChange,
  defaultScope = 'TUTORING',
  courses = [],
  onSuccess,
}: AdminResetAllowanceDialogProps) {
  const queryClient = useQueryClient()
  const studentIdInputId = useId()
  const courseSelectId = useId()
  const courseInputId = useId()
  const scopeSelectId = useId()
  const reasonTextareaId = useId()

  const [studentId, setStudentId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [scope, setScope] = useState<'TUTORING' | 'REVIEW'>(defaultScope)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const resetMutation = useMutation({
    mutationFn: () =>
      adminResetAllowance({
        studentId: studentId.trim(),
        courseId: courseId.trim(),
        scope,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allowancesKeys.all })
      onOpenChange(false)
      setStudentId('')
      setCourseId('')
      setReason('')
      setError(null)
      onSuccess?.()
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to reset allowance.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!studentId.trim()) {
      setError('Student ID is required.')
      return
    }
    if (!courseId.trim()) {
      setError('Course is required.')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    resetMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reset Student Allowance</DialogTitle>
            <DialogDescription>
              Perform an audited support reset clearing a student&apos;s daily
              allowance consumption on a course from this moment forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={studentIdInputId}>Student User ID</Label>
              <Input
                id={studentIdInputId}
                placeholder="e.g. usr_12345678"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor={courses.length > 0 ? courseSelectId : courseInputId}
              >
                Course
              </Label>
              {courses.length > 0 ? (
                <Select
                  value={courseId}
                  onValueChange={(value) => setCourseId(value ?? '')}
                >
                  <SelectTrigger id={courseSelectId} aria-label="Select course">
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
              ) : (
                <Input
                  id={courseInputId}
                  placeholder="e.g. crs_12345678"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={scopeSelectId}>Allowance Scope</Label>
              <Select
                value={scope}
                onValueChange={(val) => setScope(val as 'TUTORING' | 'REVIEW')}
              >
                <SelectTrigger
                  id={scopeSelectId}
                  aria-label="Select allowance scope"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TUTORING">Tutoring Allowance</SelectItem>
                  <SelectItem value="REVIEW">Review Allowance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={reasonTextareaId}>Audit Reason</Label>
              <Textarea
                id={reasonTextareaId}
                placeholder="Explain why this student's allowance is being reset..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                required
              />
              <p className="text-xs text-muted-foreground">
                This explanation is recorded in the permanent audit trail.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
