import {
  CheckIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
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
  defaultRole?: CourseMembershipRole
  isEditing?: boolean
  isPending?: boolean
  onSubmit: (values: {
    userIds: string[]
    role: CourseMembershipRole
  }) => void | Promise<void>
  onCancel?: () => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function AdminAssignmentForm({
  users = [],
  assignedUserIds = new Set(),
  initialValues,
  defaultRole = 'STUDENT',
  isEditing = false,
  isPending = false,
  onSubmit,
  onCancel,
}: AdminAssignmentFormProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => {
    if (initialValues?.userId) {
      return new Set([initialValues.userId])
    }
    return new Set()
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [role, setRole] = useState<CourseMembershipRole>(
    initialValues?.role ?? defaultRole,
  )

  const eligibleUsers = useMemo(
    () =>
      users.filter(
        (user) => user.role !== 'ADMIN' && !assignedUserIds.has(user.id),
      ),
    [assignedUserIds, users],
  )

  const roleMatchingUsers = useMemo(() => {
    return eligibleUsers.filter((user) => user.role === role)
  }, [eligibleUsers, role])

  // Filter by search query (display name or email)
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return roleMatchingUsers
    return roleMatchingUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    )
  }, [roleMatchingUsers, searchQuery])

  // Lookup map for selected users
  const selectedUsersList = useMemo(
    () => users.filter((u) => selectedUserIds.has(u.id)),
    [selectedUserIds, users],
  )

  const toggleUser = (userId: string) => {
    if (isEditing) return
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      for (const u of filteredUsers) {
        next.add(u.id)
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedUserIds(new Set())
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const userIdsArray = Array.from(selectedUserIds)
    if (userIdsArray.length === 0) return
    void onSubmit({ userIds: userIdsArray, role })
  }

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.has(u.id))

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {isEditing ? (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Assignment role
          </Label>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as CourseMembershipRole)}
          >
            <SelectTrigger className="w-full" aria-label="Assignment role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">Student</SelectItem>
              <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* User Selection Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isEditing ? 'Selected User' : 'Select Users'}
          </Label>
          {!isEditing && eligibleUsers.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {selectedUserIds.size > 0
                  ? `${selectedUserIds.size} selected`
                  : `${roleMatchingUsers.length} available`}
              </span>
              {filteredUsers.length > 0 ? (
                <button
                  type="button"
                  onClick={
                    allFilteredSelected ? clearSelection : selectAllFiltered
                  }
                  className="font-medium text-primary hover:underline"
                >
                  {allFilteredSelected ? 'Deselect all' : 'Select all'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <Avatar size="default">
              <AvatarFallback>
                {getInitials(initialValues?.userDisplayName ?? 'U')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">
                {initialValues?.userDisplayName ?? 'Selected User'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Search input with clear button */}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  role === 'STUDENT'
                    ? 'Search students by name or email...'
                    : 'Search instructors by name or email...'
                }
                className="pl-9 pr-8 h-9 text-xs"
                aria-label="Search users"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : null}
            </div>

            {/* Selected user chips */}
            {selectedUsersList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto p-1.5 rounded-lg bg-muted/30 border">
                {selectedUsersList.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="gap-1.5 py-0.5 pr-1 pl-2 text-xs font-normal bg-background border shadow-2xs"
                  >
                    <span className="truncate max-w-[140px]">
                      {user.displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Remove ${user.displayName}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
                {selectedUsersList.length > 1 ? (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 transition-colors"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Multi-user checklist */}
            <div
              className="max-h-52 overflow-y-auto divide-y divide-border rounded-xl border bg-card/60 p-1 select-none"
              role="group"
              aria-label="Users list"
            >
              {filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {searchQuery ? (
                    <div className="space-y-1">
                      <p>
                        No {role === 'STUDENT' ? 'students' : 'instructors'}{' '}
                        found matching &quot;{searchQuery}&quot;
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-primary hover:underline font-medium"
                      >
                        Clear search
                      </button>
                    </div>
                  ) : (
                    <p>
                      All eligible{' '}
                      {role === 'STUDENT' ? 'students' : 'instructors'} are
                      already assigned to this course.
                    </p>
                  )}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.has(user.id)
                  return (
                    <div
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault()
                          toggleUser(user.id)
                        }
                      }}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        isSelected
                          ? 'bg-primary/8 text-foreground'
                          : 'hover:bg-muted/50 text-foreground',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(user.id)}
                        className="pointer-events-none shrink-0"
                      />
                      <Avatar size="sm" className="shrink-0">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {getInitials(user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate leading-tight">
                          {user.displayName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate leading-tight">
                          {user.email}
                        </p>
                      </div>
                      <Badge
                        variant={
                          user.role === 'INSTRUCTOR' ? 'info' : 'secondary'
                        }
                        className="shrink-0 text-[10px] px-1.5 py-0 h-4 uppercase tracking-wider"
                      >
                        {user.role === 'INSTRUCTOR' ? 'Instructor' : 'Student'}
                      </Badge>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
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
        <Button
          type="submit"
          disabled={selectedUserIds.size === 0 || isPending}
          aria-label={isEditing ? 'Update assignment' : 'Add assignment'}
        >
          {isPending ? (
            <Loader2Icon className="animate-spin size-4" />
          ) : isEditing ? (
            <CheckIcon className="size-4" />
          ) : (
            <UserPlusIcon className="size-4" />
          )}
          {isPending
            ? isEditing
              ? 'Updating...'
              : 'Adding...'
            : isEditing
              ? 'Update assignment'
              : selectedUserIds.size > 1
                ? `Add ${selectedUserIds.size} ${
                    role === 'STUDENT' ? 'students' : 'instructors'
                  }`
                : role === 'STUDENT'
                  ? 'Add student'
                  : 'Add instructor'}
        </Button>
      </div>
    </form>
  )
}
