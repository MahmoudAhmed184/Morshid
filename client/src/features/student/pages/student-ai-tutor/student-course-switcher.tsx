import { Link } from '@tanstack/react-router'
import { Check, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'

interface StudentCourseSwitcherProps {
  courses: StudentCourse[]
  selectedCourse: StudentCourse
}

export function StudentCourseSwitcher({
  courses,
  selectedCourse,
}: StudentCourseSwitcherProps) {
  return (
    <div className="px-3 pb-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 rounded-2xl bg-muted/35 px-3 py-3 text-left shadow-none"
              aria-label={`Current course: ${selectedCourse.code} ${selectedCourse.title}. Choose course`}
            />
          }
        >
          <span className="size-2.5 shrink-0 rounded-full bg-amber-400" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {selectedCourse.code}
              {' · '}
              {selectedCourse.title}
            </span>
            <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              Student course
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 max-w-[90vw]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Courses</DropdownMenuLabel>
            {courses.map((course) => (
              <DropdownMenuItem
                key={course.id}
                render={
                  <Link
                    to="/student/ai-tutor"
                    search={{ courseId: course.id }}
                  />
                }
                className="gap-3 px-3 py-2.5"
              >
                <span className="size-2 shrink-0 rounded-full bg-amber-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {course.code}
                    {' · '}
                    {course.title}
                  </span>
                </span>
                {course.id === selectedCourse.id ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
