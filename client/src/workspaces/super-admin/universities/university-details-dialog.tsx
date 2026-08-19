import {
  BookOpen,
  Calendar,
  Clock,
  Edit2,
  GraduationCap,
  Landmark,
  Presentation,
  ShieldAlert,
  User,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import type { UniversityItem } from '@/features/universities/universities.schema'

type UniversityDetailsDialogProps = {
  university: UniversityItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (university: UniversityItem) => void
  onChangeStatus?: (university: UniversityItem) => void
}

function formatDate(isoString: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export function UniversityDetailsDialog({
  university,
  open,
  onOpenChange,
  onEdit,
  onChangeStatus,
}: UniversityDetailsDialogProps) {
  if (!university) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="size-5" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {university.name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 pt-0.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {university.code}
                </Badge>
                <StatusBadge status={university.status} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Primary Owner Section */}
          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <User className="size-3.5" aria-hidden />
              Primary Administrator (Owner)
            </div>
            {university.owner ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {university.owner.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {university.owner.email}
                  </p>
                </div>
                <Badge
                  variant={
                    university.owner.status === 'ACTIVE'
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="text-xs"
                >
                  {university.owner.status}
                </Badge>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                No owner currently assigned
              </p>
            )}
          </div>

          {/* Tenancy Metrics */}
          <div>
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Tenancy Statistics
            </span>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <GraduationCap
                  className="size-5 text-primary mb-1"
                  aria-hidden
                />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.studentsCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Students
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <Presentation
                  className="size-5 text-primary mb-1"
                  aria-hidden
                />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.instructorsCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Instructors
                </span>
              </div>
              <div className="flex flex-col items-center rounded-lg border bg-card p-3 text-center">
                <BookOpen className="size-5 text-primary mb-1" aria-hidden />
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {university.coursesCount}
                </span>
                <span className="text-[0.7rem] text-muted-foreground">
                  Courses
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" aria-hidden />
              <span>Created: {formatDate(university.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              <span>Updated: {formatDate(university.updatedAt)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onEdit(university)
                }}
              >
                <Edit2 className="size-3.5" aria-hidden />
                Edit
              </Button>
            ) : null}
            {onChangeStatus ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onChangeStatus(university)
                }}
              >
                <ShieldAlert className="size-3.5" aria-hidden />
                Status
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
