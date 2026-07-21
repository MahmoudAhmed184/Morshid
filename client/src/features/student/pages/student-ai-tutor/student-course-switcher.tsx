import { Link } from '@tanstack/react-router'
import { BookOpen, Check, ChevronDown } from 'lucide-react'

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
  onNavigate?: () => void
}

export function StudentCourseSwitcher({
  courses,
  selectedCourse,
  onNavigate,
}: StudentCourseSwitcherProps) {
  return (
    <div className="px-4 pt-5 pb-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full justify-start gap-3 rounded-xl border-transparent bg-secondary/60 px-2.5 text-left hover:bg-secondary"
              aria-label={`Current course: ${selectedCourse.code} ${selectedCourse.title}. Choose course`}
            />
          }
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <BookOpen className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">
              {selectedCourse.code}
              {' · '}
              {selectedCourse.title}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Switch course
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
                    onClick={onNavigate}
                  />
                }
                className="gap-3 px-3 py-2.5"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <BookOpen className="size-4" />
                </span>
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
