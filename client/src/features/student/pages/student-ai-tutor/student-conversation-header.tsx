import { BookOpen, Lock } from 'lucide-react'

interface StudentConversationHeaderProps {
  title: string
  courseCode: string
  courseTitle: string
}

export function StudentConversationHeader({
  title,
  courseCode,
  courseTitle,
}: StudentConversationHeaderProps) {
  return (
    <header className="border-b border-border bg-background/60 px-6 pt-5 pb-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-medium text-primary">
            <BookOpen className="size-3.5" aria-hidden />
            {courseCode}
          </span>
          <span className="truncate">{courseTitle}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">
            <Lock className="size-3" aria-hidden />
            Private saved history
          </span>
        </div>
        <h1 className="mt-1.5 truncate text-lg font-medium text-foreground">
          {title}
        </h1>
      </div>
    </header>
  )
}
