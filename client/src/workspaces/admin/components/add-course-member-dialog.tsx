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
  CourseMember,
  CourseMembershipRole,
} from '@/features/courses/course-administration.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

type AddCourseMemberDialogProps = {
  users: ManagedUser[]
  assignedUserIds: Set<string>
  isPending: boolean
  defaultRole?: CourseMembershipRole
  onAdd: (input: {
    userId: string
    role: CourseMembershipRole
  }) => Promise<unknown>
}

export function AddCourseMemberDialog({
  users,
  assignedUserIds,
  isPending,
  defaultRole = 'STUDENT',
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
    userIds: string[]
    role: CourseMembershipRole
  }) => {
    try {
      setErrorMessage(null)
      await Promise.all(
        values.userIds.map((userId) => onAdd({ userId, role: values.role })),
      )
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to add course assignment(s).',
      )
    }
  }

  const buttonLabel =
    defaultRole === 'INSTRUCTOR' ? 'Add doctor' : 'Add student'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            disabled={eligibleUsers.length === 0}
            aria-label="Add assignment"
          />
        }
      >
        <UserPlusIcon className="size-4" />
        {buttonLabel}
      </DialogTrigger>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>
            {defaultRole === 'INSTRUCTOR'
              ? 'Add doctor assignments'
              : 'Add student assignments'}
          </DialogTitle>
          <DialogDescription>
            Search and select one or more users to assign to this course.
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
          defaultRole={defaultRole}
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type EditCourseMemberDialogProps = {
  member: CourseMember
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
