const steps = [
  {
    numeral: 'i.',
    title: 'Shelve',
    prose:
      'An instructor uploads the syllabus, lecture slides, and notes. Morshid reads and indexes every page.',
  },
  {
    numeral: 'ii.',
    title: 'Ask',
    prose:
      'Pose the question the way you would to a colleague. Plain language is enough.',
  },
  {
    numeral: 'iii.',
    title: 'Understand',
    prose:
      'Arrive at the answer yourself, one question at a time — with the page numbers to prove it.',
  },
] as const

export function CourseSection() {
  return (
    <section
      id="instructors"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24 md:px-10 md:py-32"
    >
      <header>
        <div className="flex items-center gap-3">
          <span className="font-display text-[1.5rem] leading-none text-muted-foreground">
            03
          </span>
          <span className="rubric-square" aria-hidden />
          <span className="smallcaps-label">From shelf to session</span>
        </div>
        <h2 className="mt-5 max-w-[20ch] font-display text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.05] font-semibold text-balance text-foreground">
          Three steps, then it knows the course.
        </h2>
      </header>

      <div className="rule mt-16 grid grid-cols-1 gap-10 pt-10 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title}>
            <p className="font-display text-[1.75rem] leading-none text-muted-foreground">
              {step.numeral}
            </p>
            <h3 className="mt-3 text-lg font-medium text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {step.prose}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
