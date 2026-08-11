import { CheckIcon, Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CourseMembershipRole } from '@/features/courses/course-administration.schema'
import type { ManagedUser } from '@/features/user-management/managed-user.schema'

type AdminAssignmentFormProps = {
  users?: ManagedUser[]
  assignedUserIds?: Set<string>
  initialValues?: {
    userId?: string
    role?: CourseMembershipRole
    userDisplayName?: string
  }
  isEditing?: boolean
  isPending?: boolean
  onSubmit: (values: {
    userId: string
    role: CourseMembershipRole
  }) => void | Promise<void>
  onCancel?: () => void
}

export function AdminAssignmentForm({
  users = [],
  assignedUserIds = new Set(),
  initialValues,
  isEditing = false,
  isPending = false,
  onSubmit,
  onCancel,
}: AdminAssignmentFormProps) {
  const [userId, setUserId] = useState(initialValues?.userId ?? '')
  const [role, setRole] = useState<CourseMembershipRole>(
    initialValues?.role ?? 'STUDENT',
  )

  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (user) => user.role !== 'ADMIN' && !assignedUserIds.has(user.id),
      ),
    [assignedUserIds, users],
  )

  const userSelectItems = useMemo(
    () =>
      eligibleUsers.map((user) => ({
        value: user.id,
        label: `${user.displayName} (${user.email})`,
      })),
    [eligibleUsers],
  )

  const roleSelectItems = [
    { value: 'STUDENT' as const, label: 'Student' },
    { value: 'INSTRUCTOR' as const, label: 'Instructor' },
  ]

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const targetUserId = isEditing ? (initialValues?.userId ?? userId) : userId
    if (!targetUserId) return
    void onSubmit({ userId: targetUserId, role })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>User</Label>
        {isEditing ? (
          <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
            {initialValues?.userDisplayName ?? 'Selected User'}
          </div>
        ) : (
          <Select
            value={userId || null}
            onValueChange={(value) => setUserId(value ?? '')}
            items={userSelectItems}
          >
            <SelectTrigger className="w-full" aria-label="User">
              <SelectValue placeholder="Choose a user" />
            </SelectTrigger>
            <SelectContent>
              {userSelectItems.map((user) => (
                <SelectItem key={user.value} value={user.value}>
                  {user.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>Course role</Label>
        <Select
          value={role}
          onValueChange={(value) => {
            if (value) setRole(value)
          }}
          items={roleSelectItems}
        >
          <SelectTrigger className="w-full" aria-label="Course role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleSelectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={(!isEditing && !userId) || isPending}>
          {isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : isEditing ? (
            <CheckIcon />
          ) : (
            <UserPlusIcon />
          )}
          {isPending
            ? isEditing
              ? 'Updating...'
              : 'Adding...'
            : isEditing
              ? 'Update assignment'
              : 'Add assignment'}
        </Button>
      </div>
    </form>
  )
}
