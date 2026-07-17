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
    <header className="px-6 pt-6 pb-2 sm:px-8">
      <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{courseCode}</span>
        {' · '}
        {courseTitle} · Private saved history
      </p>
    </header>
  )
}
