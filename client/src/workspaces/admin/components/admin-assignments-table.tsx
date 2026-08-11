import { ClipboardCheckIcon, EyeIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EditCourseMemberDialog } from './add-course-member-dialog'
import type {
  CourseMember,
  CourseMembershipRole,
} from '@/features/courses/course-administration.schema'

type AdminAssignmentsTableProps = {
  courseId?: string
  members: CourseMember[]
  isPending: boolean
  onRoleChange: (userId: string, role: CourseMembershipRole) => void
  onRemove: (userId: string) => Promise<unknown>
}

const roleSelectItems = [
  { value: 'STUDENT' as const, label: 'Student' },
  { value: 'INSTRUCTOR' as const, label: 'Instructor' },
]

export function AdminAssignmentsTable({
  courseId,
  members,
  isPending,
  onRoleChange,
  onRemove,
}: AdminAssignmentsTableProps) {
  const [selectedMember, setSelectedMember] = useState<CourseMember | null>(
    null,
  )

  return (
    <div>
      {/* Mobile Compact List (< md) — No Horizontal Scroll */}
      <div className="divide-y divide-border md:hidden">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3.5 gap-3 hover:bg-secondary/20 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-semibold text-foreground truncate text-sm">
                {member.user.displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.user.email}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                <span className="capitalize font-medium text-foreground">
                  {member.role.toLowerCase()}
                </span>
                <span>•</span>
                <span className="capitalize">
                  {member.user.role.toLowerCase()}
                </span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1">
              <EditCourseMemberDialog
                member={member}
                isPending={isPending}
                onUpdateRole={async (role: CourseMembershipRole) =>
                  onRoleChange(member.userId, role)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedMember(member)}
                aria-label="View assignment details"
                className="text-muted-foreground hover:text-foreground"
              >
                <EyeIcon className="size-4" />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" disabled={isPending}>
                    <Trash2Icon />
                    <span className="sr-only">Remove assignment</span>
                  </Button>
                }
                title="Remove course assignment?"
                description={`${member.user.displayName} will lose access to this course.`}
                confirmLabel="Remove"
                disabled={isPending}
                onConfirm={async () => {
                  await onRemove(member.userId)
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block">
        <Table className="w-full min-w-[680px]">
          <TableHeader className="bg-secondary/40">
            <TableRow>
              <TableHead className="smallcaps-label h-11 px-4 pl-6">
                User
              </TableHead>
              <TableHead className="smallcaps-label h-11 px-4">
                Account role
              </TableHead>
              <TableHead className="smallcaps-label h-11 px-4">
                Course role
              </TableHead>
              <TableHead className="smallcaps-label h-11 px-4 pr-6 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow
                key={member.id}
                className="h-[52px] hover:bg-secondary/40"
              >
                <TableCell className="px-4 py-3.5 pl-6 min-w-0">
                  <p className="font-medium text-foreground truncate max-w-[240px]">
                    {member.user.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                    {member.user.email}
                  </p>
                </TableCell>
                <TableCell className="px-4 py-3.5 capitalize">
                  {member.user.role.toLowerCase()}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      onRoleChange(member.userId, value as CourseMembershipRole)
                    }
                    items={roleSelectItems}
                  >
                    <SelectTrigger
                      className="h-8 text-xs font-medium border-border/80 w-[130px]"
                      aria-label={`Course role for ${member.user.displayName}`}
                    >
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
                </TableCell>
                <TableCell className="px-4 py-3.5 pr-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditCourseMemberDialog
                      member={member}
                      isPending={isPending}
                      onUpdateRole={async (role: CourseMembershipRole) =>
                        onRoleChange(member.userId, role)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSelectedMember(member)}
                      aria-label="View assignment details"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                        >
                          <Trash2Icon />
                          <span className="sr-only">Remove assignment</span>
                        </Button>
                      }
                      title="Remove course assignment?"
                      description={`${member.user.displayName} will lose access to this course.`}
                      confirmLabel="Remove"
                      disabled={isPending}
                      onConfirm={async () => {
                        await onRemove(member.userId)
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(selectedMember)}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheckIcon className="size-5 text-primary" />
              Course Membership Details
            </DialogTitle>
          </DialogHeader>

          {selectedMember ? (
            <div className="grid gap-3.5 py-1 text-sm">
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Member Name & Email
                </p>
                <p className="font-semibold text-foreground text-base">
                  {selectedMember.user.displayName}
                </p>
                <p className="text-xs text-muted-foreground select-all">
                  {selectedMember.user.email}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Course Role
                  </p>
                  <p className="font-semibold text-primary capitalize">
                    {selectedMember.role.toLowerCase()}
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Account Role
                  </p>
                  <p className="font-medium text-foreground capitalize">
                    {selectedMember.user.role.toLowerCase()}
                  </p>
                </div>
              </div>

              {courseId ? (
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Course ID
                  </p>
                  <p className="font-mono text-xs text-foreground select-all break-all">
                    {courseId}
                  </p>
                </div>
              ) : null}

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Membership ID
                </p>
                <p className="font-mono text-xs text-foreground select-all break-all">
                  {selectedMember.id}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
