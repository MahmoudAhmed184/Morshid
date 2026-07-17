interface StudentConversationHeaderProps {
  title: string
}

export function StudentConversationHeader({
  title,
}: StudentConversationHeaderProps) {
  return (
    <header className="border-b border-border px-4 py-3 sm:px-6">
      <h3 className="truncate text-sm font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Saved private history
      </p>
    </header>
  )
}
