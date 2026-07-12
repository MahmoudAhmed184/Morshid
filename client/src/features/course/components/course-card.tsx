import {
  BookOpenIcon,
  FileTextIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AuthRole } from '@/features/auth/schemas/auth.schema'
import type { Course } from '@/features/course/schemas/course.schema'

type CourseCardProps = {
  course: Course
  viewerRole: AuthRole
  onEditCourse?: (course: Course) => void
  onDeleteCourse?: (course: Course) => void
}

const updatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function CourseCard({
  course,
  viewerRole,
  onEditCourse,
  onDeleteCourse,
}: CourseCardProps) {
  const { adminMetadata } = course
  const instructors = adminMetadata.memberships
    .filter((membership) => membership.role === 'INSTRUCTOR')
    .map((membership) => membership.user.displayName)
  const canManageCourse = viewerRole === 'ADMIN'

  return (
    <Card className="h-full gap-5 border border-border shadow-sm">
      <CardHeader className="gap-2">
        {canManageCourse ? (
          <CardAction>
            <CourseActions
              course={course}
              onEditCourse={onEditCourse}
              onDeleteCourse={onDeleteCourse}
            />
          </CardAction>
        ) : null}
        <Badge variant="outline" className="w-fit font-mono text-[0.7rem]">
          {course.code}
        </Badge>
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {instructors.length > 0
            ? instructors.join(', ')
            : 'No instructor assigned'}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-3 gap-3">
        <CourseMetric
          icon={UsersIcon}
          label="Members"
          value={adminMetadata.memberCount}
        />
        <CourseMetric
          icon={GraduationCapIcon}
          label="Instructors"
          value={adminMetadata.instructorCount}
        />
        <CourseMetric
          icon={FileTextIcon}
          label="Materials"
          value={adminMetadata.materialCount}
        />
      </CardContent>

      <CardContent className="mt-auto flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
        <BookOpenIcon className="size-3.5" />
        {adminMetadata.activeMaterialCount} active materials
        <span aria-hidden="true">&bull;</span>
        Updated {updatedAtFormatter.format(new Date(adminMetadata.updatedAt))}
      </CardContent>
    </Card>
  )
}

type CourseActionsProps = Pick<
  CourseCardProps,
  'course' | 'onEditCourse' | 'onDeleteCourse'
>

function CourseActions({
  course,
  onEditCourse,
  onDeleteCourse,
}: CourseActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Course actions for ${course.title}`}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={onEditCourse === undefined}
          onClick={() => onEditCourse?.(course)}
        >
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={onDeleteCourse === undefined}
          variant="destructive"
          onClick={() => onDeleteCourse?.(course)}
        >
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type CourseMetricProps = {
  icon: typeof UsersIcon
  label: string
  value: number
}

function CourseMetric({ icon: Icon, label, value }: CourseMetricProps) {
  return (
    <div className="min-w-0 rounded-md bg-muted/70 px-3 py-2.5">
      <Icon className="mb-2 size-4 text-muted-foreground" />
      <p className="text-base font-semibold text-foreground">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
