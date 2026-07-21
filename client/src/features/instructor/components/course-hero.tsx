import { Link } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'

export function CourseHeroSkeleton() {
  return (
    <Card aria-label="Loading course" className="p-6" role="status">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="rule mt-5 pt-4">
        <Skeleton className="h-4 w-40" />
      </div>
    </Card>
  )
}

export function CourseHero({ course }: { course: InstructorCourse }) {
  return (
    <Card className="hover-float flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5"
          aria-hidden
        >
          <BookOpen />
        </span>
        <Badge variant="success">Assigned</Badge>
      </div>
      <div className="mt-4 min-w-0 space-y-1">
        <h3 className="truncate text-lg font-medium text-foreground">
          {course.title}
        </h3>
        <p className="footnote">{course.code}</p>
      </div>
      <div className="rule mt-5 pt-4">
        <Link
          to="/instructor/materials"
          className="link-editorial footnote w-fit"
        >
          Manage materials →
        </Link>
      </div>
    </Card>
  )
}
