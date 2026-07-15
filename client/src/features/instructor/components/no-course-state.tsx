import { BookOpen } from 'lucide-react'

import { EmptyState } from '@/components/ui/custom/empty-state'

export function NoCourseState() {
  return (
    <EmptyState
      icon={<BookOpen aria-hidden />}
      title="No assigned courses"
      description="This instructor account does not have a course assignment in the current auth session."
      className="min-h-56 rounded-[8px] border-border bg-card text-card-foreground [&_h2]:text-foreground [&_p]:text-muted-foreground"
    />
  )
}
