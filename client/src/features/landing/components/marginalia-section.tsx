import { Reveal } from '@/components/reveal'

export function MarginaliaSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12 md:px-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/80 p-6 shadow-xl backdrop-blur-xs sm:rounded-3xl sm:p-10 md:p-12">
          {/* Decorative Watermark Quote Mark */}
          <span
            className="pointer-events-none absolute -top-4 -left-2 font-display text-8xl font-black text-primary/10 select-none sm:-top-8 sm:left-4 sm:text-9xl"
            aria-hidden
          >
            “
          </span>

          <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            <figure className="lg:col-span-12">
              <blockquote className="text-balance font-display text-lg font-medium leading-relaxed text-foreground italic sm:text-2xl lg:text-3xl">
                “It feels less like a search engine and more like a colleague
                who has read every page of the syllabus.”
              </blockquote>

              <figcaption className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary sm:size-10">
                  IP
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                    Early Instructor Pilot
                  </p>
                  <p className="font-mono text-[0.68rem] text-muted-foreground sm:text-xs">
                    Verified Faculty Feedback · Morshid Academic Pilot
                  </p>
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
