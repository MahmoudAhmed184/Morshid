import { useState, useId, useMemo } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { AlertCircle, Loader2, RotateCcw, Search, X } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getManagedUsers } from '@/features/user-management/interface'
import { adminResetAllowance } from '../allowances.api'
import { allowancesKeys } from '../allowances.queries'

interface AdminResetAllowanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultScope?: 'TUTORING' | 'REVIEW'
  courses?: Array<{ id: string; code: string; title: string }>
  onSuccess?: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const scopeOptions: readonly {
  value: 'TUTORING' | 'REVIEW' | 'BOTH'
  label: string
}[] = [
  { value: 'TUTORING', label: 'Tutoring Allowance Only' },
  { value: 'REVIEW', label: 'Review Allowance Only' },
  { value: 'BOTH', label: 'Both Tutoring & Review Allowances' },
]

function searchStudentsQueryOptions(searchTerm: string) {
  return queryOptions({
    queryKey: ['admin-managed-users', 'STUDENT', searchTerm],
    queryFn: () =>
      getManagedUsers({
        role: 'STUDENT',
        status: 'ACTIVE',
        search: searchTerm || undefined,
        limit: 10,
      }),
  })
}

export function AdminResetAllowanceDialog({
  open,
  onOpenChange,
  defaultScope = 'TUTORING',
  courses = [],
  onSuccess,
}: AdminResetAllowanceDialogProps) {
  const queryClient = useQueryClient()
  const studentEmailInputId = useId()
  const courseSelectId = useId()
  const scopeSelectId = useId()
  const reasonTextareaId = useId()

  const [studentInput, setStudentInput] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string
    email: string
    displayName: string
  } | null>(null)
  const [courseId, setCourseId] = useState('')
  const [scope, setScope] = useState<'TUTORING' | 'REVIEW' | 'BOTH'>(
    defaultScope,
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Query matching students when searching
  const usersQuery = useQuery({
    ...searchStudentsQueryOptions(studentInput.trim()),
    enabled: open && !selectedStudent && studentInput.trim().length > 0,
  })

  const suggestedStudents = useMemo(
    () => usersQuery.data?.users ?? [],
    [usersQuery.data],
  )

  const resetMutation = useMutation({
    mutationFn: () =>
      adminResetAllowance({
        studentId: selectedStudent?.id,
        studentEmail: selectedStudent ? undefined : studentInput.trim(),
        courseId: courseId.trim(),
        scope,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allowancesKeys.all })
      onOpenChange(false)
      setStudentInput('')
      setSelectedStudent(null)
      setCourseId('')
      setReason('')
      setError(null)
      onSuccess?.()
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to reset allowance.')
    },
  })

  const courseSelectItems = useMemo(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: `${course.code} — ${course.title}`,
      })),
    [courses],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const effectiveEmail = selectedStudent?.email || studentInput.trim()
    if (!effectiveEmail && !selectedStudent?.id) {
      setError('Please select a student or enter a student email.')
      return
    }
    if (!courseId.trim()) {
      setError('Please select a course.')
      return
    }
    if (!reason.trim()) {
      setError('A support reason is required.')
      return
    }
    resetMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setError(null)
        }
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-primary" aria-hidden />
              Reset Student Allowance
            </DialogTitle>
            <DialogDescription>
              Perform an audited support reset clearing a student&apos;s daily
              allowance consumption for a course from this moment forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Student Selector / Search */}
            <div className="space-y-1.5">
              <Label
                htmlFor={studentEmailInputId}
                className="text-xs font-medium"
              >
                Student Email or Search
              </Label>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-2 px-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(selectedStudent.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-medium text-foreground">
                        {selectedStudent.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedStudent.email}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSelectedStudent(null)
                      setStudentInput('')
                    }}
                    aria-label="Remove selected student"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={studentEmailInputId}
                      placeholder="student@morshid.demo or search name..."
                      value={studentInput}
                      onChange={(e) => setStudentInput(e.target.value)}
                      className="pl-8"
                      required={!selectedStudent}
                      autoComplete="off"
                    />
                  </div>

                  {suggestedStudents.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur-md">
                      {suggestedStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent({
                              id: student.id,
                              email: student.email,
                              displayName: student.displayName,
                            })
                            setStudentInput(student.email)
                          }}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[9px]">
                              {getInitials(student.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium text-foreground">
                              {student.displayName}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {student.email}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Course Selector */}
            <div className="space-y-1.5">
              <Label htmlFor={courseSelectId} className="text-xs font-medium">
                Course
              </Label>
              <Select
                value={courseId}
                items={courseSelectItems}
                onValueChange={(value) => {
                  if (value) setCourseId(value)
                }}
              >
                <SelectTrigger
                  id={courseSelectId}
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

            {/* Allowance Scope */}
            <div className="space-y-1.5">
              <Label htmlFor={scopeSelectId} className="text-xs font-medium">
                Allowance Scope
              </Label>
              <Select
                value={scope}
                items={scopeOptions}
                onValueChange={(val) => {
                  if (
                    val === 'TUTORING' ||
                    val === 'REVIEW' ||
                    val === 'BOTH'
                  ) {
                    setScope(val)
                  }
                }}
              >
                <SelectTrigger
                  id={scopeSelectId}
                  aria-label="Select allowance scope"
                  className="w-full"
                >
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audit Reason */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={reasonTextareaId}
                  className="text-xs font-medium"
                >
                  Audit Reason
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {reason.length}/500
                </span>
              </div>
              <Textarea
                id={reasonTextareaId}
                placeholder="e.g. Student experienced network disconnection during graded lab..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                required
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Recorded in the immutable system audit log with your admin
                identity.
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
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Confirm Reset'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
