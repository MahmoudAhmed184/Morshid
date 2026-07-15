type InstructorSectionHeaderProps = {
  description: string
  title: string
}

export function InstructorSectionHeader({
  description,
  title,
}: InstructorSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}
