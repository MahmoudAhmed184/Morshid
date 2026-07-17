type StudentPageHeaderProps = {
  title: string
}

export function StudentPageHeader({ title }: StudentPageHeaderProps) {
  return (
    <header className="mb-5">
      <p className="text-sm text-muted-foreground">Student Workspace</p>
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
        {title}
      </h1>
    </header>
  )
}
