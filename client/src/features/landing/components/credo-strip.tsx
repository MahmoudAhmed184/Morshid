const credoItems = [
  'Grounded in your syllabus',
  'Cited to the page',
  'Socratic by method',
  'Ready 24/7 for exams',
] as const

export function CredoStrip() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 sm:py-5 md:px-10">
      <ul className="grid grid-cols-2 gap-2 text-center sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
        {credoItems.map((item) => (
          <li
            key={item}
            className="glass-paper flex items-center justify-center rounded-full border border-border/60 bg-card/60 px-3 py-2 text-center shadow-2xs backdrop-blur-xs sm:px-5 sm:py-2.5"
          >
            <span className="smallcaps-label text-[0.65rem] tracking-wider text-foreground/80 sm:text-xs">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
