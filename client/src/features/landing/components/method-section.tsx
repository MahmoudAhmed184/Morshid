import ScrollStack, { ScrollStackItem } from '@/components/ScrollStack'
import { Badge } from '@/components/ui/badge'

const shelfFiles = [
  { name: 'syllabus.pdf', pages: '24 pp' },
  { name: 'lecture-08-quicksort.pdf', pages: '31 pp' },
  { name: 'problem-set-3.pdf', pages: '6 pp' },
] as const

export function MethodSection() {
  return (
    <section
      id="method"
      className="mx-auto w-full max-w-6xl scroll-mt-32 px-4 py-8 sm:px-6 sm:py-16 md:px-10 md:py-24"
    >
      <header className="mb-6 sm:mb-10">
        <div className="flex items-center gap-3">
          <span className="display-index leading-none">02</span>
          <span className="rubric-square" aria-hidden />
          <span className="smallcaps-label">The Method</span>
        </div>
        <h2 className="display-2 mt-5 max-w-[20ch] text-balance text-foreground">
          It teaches the way good teachers do.
        </h2>
      </header>

      <ScrollStack>
        {/* Card 01 — the Socratic turn */}
        <ScrollStackItem index={0}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-12">
            <p className="display-3 leading-none text-muted-foreground lg:col-span-1">
              01
            </p>
            <div className="lg:col-span-5 lg:col-start-2">
              <h3 className="display-3 text-foreground">
                It asks before it answers.
              </h3>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                Handing you the answer would be the fastest way to make you
                forget it. Morshid poses the next question — the one that walks
                you to the answer yourself.
              </p>
            </div>
            <figure className="lg:col-span-5 lg:col-start-8">
              <div className="rounded-2xl border bg-muted/40 p-6 shadow-xs">
                <div className="space-y-4">
                  <div>
                    <p className="smallcaps-label text-rubric!">Student.</p>
                    <p className="mt-1 font-display text-lg leading-snug text-foreground italic">
                      Where should the pivot land?
                    </p>
                  </div>
                  <div>
                    <p className="smallcaps-label text-info!">Morshid.</p>
                    <p className="mt-1 leading-relaxed text-foreground">
                      You tell me — what has to be true of everything to its
                      left?
                    </p>
                  </div>
                </div>
              </div>
              <figcaption className="footnote mt-3">
                fig. 1 — the Socratic turn
              </figcaption>
            </figure>
          </div>
        </ScrollStackItem>

        {/* Card 02 — the shelf */}
        <ScrollStackItem index={1}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-12">
            <p className="display-3 leading-none text-muted-foreground lg:col-span-1">
              02
            </p>
            <div className="lg:col-span-5 lg:col-start-2">
              <h3 className="display-3 text-foreground">
                It reads what your professor assigned.
              </h3>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                No open-web guessing, no generic textbook voice. Your course's
                own syllabus, slides, and notes are the entire universe of
                every answer.
              </p>
            </div>
            <figure className="lg:col-span-5 lg:col-start-8">
              <div className="rounded-2xl border bg-muted/40 p-6 shadow-xs">
                <ul className="space-y-2.5">
                  {shelfFiles.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between gap-3 border-b border-border/80 pb-2.5 last:border-b-0 last:pb-0"
                    >
                      <span className="font-mono text-xs text-foreground">
                        {file.name}{' '}
                        <span className="text-muted-foreground">
                          · {file.pages}
                        </span>
                      </span>
                      <Badge variant="success">Indexed</Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <figcaption className="footnote mt-3">
                fig. 2 — the shelf
              </figcaption>
            </figure>
          </div>
        </ScrollStackItem>

        {/* Card 03 — the receipt */}
        <ScrollStackItem index={2}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 lg:grid-cols-12">
            <p className="display-3 leading-none text-muted-foreground lg:col-span-1">
              03
            </p>
            <div className="lg:col-span-5 lg:col-start-2">
              <h3 className="display-3 text-foreground">
                It cites the page, every time.
              </h3>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                Every claim carries a superscript. Every superscript resolves
                to a page you can open. If Morshid cannot cite it, Morshid will
                not say it.
              </p>
            </div>
            <figure className="lg:col-span-5 lg:col-start-8">
              <div className="rounded-2xl border bg-muted/40 p-6 shadow-xs">
                <div>
                  <p className="leading-relaxed text-foreground">
                    Halving n repeatedly reaches 1 after about log n steps.
                    <sup className="ml-0.5 align-super text-[0.7em] font-medium text-info">
                      3
                    </sup>
                  </p>
                  <p className="rule footnote mt-4 pt-4">
                    3 — Lecture 08 · Quicksort —{' '}
                    <span className="text-rubric">p. 12</span>
                  </p>
                </div>
              </div>
              <figcaption className="footnote mt-3">
                fig. 3 — the receipt
              </figcaption>
            </figure>
          </div>
        </ScrollStackItem>
      </ScrollStack>
    </section>
  )
}
