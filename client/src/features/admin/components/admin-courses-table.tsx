import { BookOpenIcon, EyeIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminCourse } from '@/features/admin/schemas/admin-course.schema'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

import { EditAdminCourseDialog } from './course-dialogs'

export function AdminCoursesTable({
  courses,
  onUpdateCourse,
}: {
  courses: AdminCourse[]
  onUpdateCourse?: (
    courseId: string,
    values: { code: string; title: string },
  ) => Promise<unknown>
}) {
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null>(null)

  return (
    <>
      {/* Mobile Compact List (< md) — No Horizontal Scroll */}
      <div className="divide-y divide-border md:hidden">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex items-center justify-between p-3.5 gap-3 hover:bg-secondary/20 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate text-sm">
                {course.title}
              </p>
              <p className="text-xs font-mono text-muted-foreground pt-0.5">
                {course.code}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-1">
              {onUpdateCourse ? (
                <EditAdminCourseDialog
                  course={course}
                  onUpdateCourse={(values) => onUpdateCourse(course.id, values)}
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedCourse(course)}
                aria-label="View course details"
                className="text-muted-foreground hover:text-foreground"
              >
                <EyeIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block w-full max-h-[65vh] overflow-x-auto overflow-y-auto scrollbar-themed">
        <Table className="w-full min-w-[820px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow>
              <TableHead className="w-[30%] min-w-[220px] smallcaps-label h-11 px-4 pl-6">
                Course
              </TableHead>
              <TableHead className="w-[25%] min-w-[180px] smallcaps-label h-11 px-4">
                Instructors
              </TableHead>
              <TableHead className="w-[15%] min-w-[100px] smallcaps-label h-11 px-4">
                Students
              </TableHead>
              <TableHead className="w-[15%] min-w-[120px] smallcaps-label h-11 px-4">
                Materials
              </TableHead>
              <TableHead className="w-[10%] min-w-[130px] smallcaps-label h-11 px-4 text-right">
                Updated
              </TableHead>
              <TableHead className="w-[5%] min-w-[60px] smallcaps-label h-11 px-4 pr-6 text-center">
                View
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => {
              const instructors = course.adminMetadata.memberships
                .filter((membership) => membership.role === 'INSTRUCTOR')
                .map((membership) => membership.user.displayName)

              return (
                <TableRow
                  key={course.id}
                  className="h-[52px] hover:bg-secondary/40"
                >
                  <TableCell className="px-4 py-3.5 pl-6 min-w-0">
                    <p className="font-medium text-foreground truncate max-w-[240px]">
                      {course.title}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {course.code}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 min-w-0">
                    {instructors.length > 0 ? (
                      <p className="truncate max-w-[200px]">
                        {instructors.join(', ')}
                      </p>
                    ) : (
                      <span className="text-muted-foreground">
                        Not assigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 tabular-nums">
                    {course.adminMetadata.studentCount}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 tabular-nums">
                    {course.adminMetadata.materialCount} total
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums text-right whitespace-nowrap">
                    {dateFormatter.format(
                      new Date(course.adminMetadata.updatedAt),
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 pr-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {onUpdateCourse ? (
                        <EditAdminCourseDialog
                          course={course}
                          onUpdateCourse={(values) =>
                            onUpdateCourse(course.id, values)
                          }
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSelectedCourse(course)}
                        aria-label="View course details"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(selectedCourse)}
        onOpenChange={(open) => !open && setSelectedCourse(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpenIcon className="size-5 text-primary" />
              Course Overview
            </DialogTitle>
          </DialogHeader>

          {selectedCourse ? (
            <div className="grid gap-3.5 py-1 text-sm">
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Course Title & Code
                </p>
                <p className="font-semibold text-foreground text-base">
                  {selectedCourse.title}
                </p>
                <p className="font-mono text-xs text-primary font-bold">
                  {selectedCourse.code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Students
                  </p>
                  <p className="font-bold text-foreground text-lg">
                    {selectedCourse.adminMetadata.studentCount}
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Materials
                  </p>
                  <p className="font-bold text-foreground text-lg">
                    {selectedCourse.adminMetadata.materialCount}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Instructors
                </p>
                <p className="font-medium text-foreground">
                  {selectedCourse.adminMetadata.memberships
                    .filter((m) => m.role === 'INSTRUCTOR')
                    .map((m) => `${m.user.displayName} (${m.user.email})`)
                    .join(', ') || 'No instructor assigned'}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Course ID
                </p>
                <p className="font-mono text-xs text-foreground select-all break-all">
                  {selectedCourse.id}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Last Updated
                </p>
                <p className="font-medium text-foreground">
                  {dateFormatter.format(
                    new Date(selectedCourse.adminMetadata.updatedAt),
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
