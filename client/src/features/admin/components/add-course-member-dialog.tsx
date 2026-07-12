import { UserPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CourseMembershipRole } from '@/features/admin/schemas/admin-course.schema'
import type { AdminManagedUser } from '@/features/admin/schemas/admin-managed-user.schema'

type AddCourseMemberDialogProps = {
  users: AdminManagedUser[]
  assignedUserIds: Set<string>
  isPending: boolean
  onAdd: (input: {
    userId: string
    role: CourseMembershipRole
  }) => Promise<unknown>
}

export function AddCourseMemberDialog({
  users,
  assignedUserIds,
  isPending,
  onAdd,
}: AddCourseMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<CourseMembershipRole>('STUDENT')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (user) => user.role !== 'ADMIN' && !assignedUserIds.has(user.id),
      ),
    [assignedUserIds, users],
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setUserId('')
      setRole('STUDENT')
      setErrorMessage(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) return

    try {
      await onAdd({ userId, role })
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to add this course assignment.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button disabled={eligibleUsers.length === 0} />}>
        <UserPlusIcon />
        Add assignment
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add course assignment</DialogTitle>
          <DialogDescription>
            Assign a student or instructor to the selected course.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>User</Label>
            <Select
              value={userId}
              onValueChange={(value) => setUserId(value ?? '')}
            >
              <SelectTrigger className="w-full" aria-label="User">
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {eligibleUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.displayName} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Course role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                if (value) setRole(value)
              }}
            >
              <SelectTrigger className="w-full" aria-label="Course role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!userId || isPending}>
              {isPending ? 'Adding...' : 'Add assignment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
