import { PencilIcon, UserPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AdminAssignmentForm } from './admin-assignment-form'
import type {
  AdminCourseMember,
  CourseMembershipRole,
} from '@/features/admin/schemas/admin-course.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

type AddCourseMemberDialogProps = {
  users: ManagedUser[]
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
      setErrorMessage(null)
    }
  }

  const handleSubmit = async (values: {
    userId: string
    role: CourseMembershipRole
  }) => {
    try {
      setErrorMessage(null)
      await onAdd(values)
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
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <AdminAssignmentForm
          users={users}
          assignedUserIds={assignedUserIds}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type EditCourseMemberDialogProps = {
  member: AdminCourseMember
  isPending: boolean
  onUpdateRole: (role: CourseMembershipRole) => Promise<unknown>
}

export function EditCourseMemberDialog({
  member,
  isPending,
  onUpdateRole,
}: EditCourseMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (values: { role: CourseMembershipRole }) => {
    try {
      setErrorMessage(null)
      await onUpdateRole(values.role)
      setOpen(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update assignment role.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            aria-label={`Edit assignment for ${member.user.displayName}`}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update course assignment</DialogTitle>
          <DialogDescription>
            Update role assignment for {member.user.displayName}.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <AdminAssignmentForm
          isEditing
          isPending={isPending}
          initialValues={{
            userId: member.userId,
            role: member.role,
            userDisplayName: `${member.user.displayName} (${member.user.email})`,
          }}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
