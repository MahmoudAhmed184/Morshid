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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <h1 className="min-w-0 truncate text-sm font-semibold text-foreground">
        {title}
      </h1>
      <span className="text-muted-foreground" aria-hidden>
        ·
      </span>
      <p className="min-w-0 truncate text-xs text-muted-foreground">
        <span className="font-medium">{courseCode}</span> {courseTitle}
      </p>
    </header>
  )
}
