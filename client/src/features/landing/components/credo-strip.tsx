const credoItems = [
  'Grounded in your syllabus',
  'Cited to the page',
  'Socratic by method',
  'Ready the night before the exam',
] as const

export function CredoStrip() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-5 md:px-10">
      <ul className="flex flex-wrap items-center justify-center gap-3">
        {credoItems.map((item) => (
          <li key={item} className="glass-paper rounded-full px-5 py-2.5">
            <span className="smallcaps-label text-foreground/70">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
