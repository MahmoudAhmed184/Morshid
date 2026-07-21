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
    <header className="border-b border-border/60 bg-card/40 px-6 pt-5 pb-4 backdrop-blur-sm sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
            <BookOpen className="size-3.5" aria-hidden />
            {courseCode}
          </span>
          <span className="truncate">{courseTitle}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">
            <Lock className="size-3" aria-hidden />
            Private saved history
          </span>
        </div>
      </div>
    </header>
  )
}
