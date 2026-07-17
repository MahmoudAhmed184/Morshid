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
    <header className="border-b border-border px-4 py-3 sm:px-6">
      <h1 className="truncate text-sm font-semibold text-foreground">
        {title}
      </h1>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{courseCode}</span>
        {' · '}
        {courseTitle} · private saved history
      </p>
    </header>
  )
}
