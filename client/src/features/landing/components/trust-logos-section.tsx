const studyPrinciples = [
  'Course-bound answers',
  'Page-level citations',
  'Socratic questions',
  'Private workspaces',
  'Instructor materials',
  'Grounded review',
] as const

export function TrustLogosSection() {
  return (
    <section
      aria-labelledby="study-principles-title"
      className="border-y border-border/60 bg-muted/20 py-8 sm:py-10"
    >
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <p
          id="study-principles-title"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Built for focused, course-grounded study
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {studyPrinciples.map((principle) => (
            <li
              key={principle}
              className="text-sm font-semibold tracking-tight text-foreground/80"
            >
              {principle}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
