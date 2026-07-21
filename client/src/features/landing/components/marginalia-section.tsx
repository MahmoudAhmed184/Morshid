export function MarginaliaSection() {
  return (
    <section className="rule">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <figure className="lg:col-span-9 lg:col-start-2">
            {/* Printer's dash — a 2px rule, 3rem wide, 3rem above the quote. */}
            <div className="rule-strong mb-12 w-12" aria-hidden />
            <blockquote className="font-display text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.15] font-semibold text-balance text-foreground italic">
              “It feels less like a search engine and more like a colleague who
              has read every page of the syllabus.”
            </blockquote>
            <figcaption className="footnote mt-6">
              — from an early instructor pilot
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
