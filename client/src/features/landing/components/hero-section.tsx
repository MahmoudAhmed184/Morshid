import { Link } from '@tanstack/react-router'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SpeakerLabelProps = {
  children: React.ReactNode
  /** STUDENT. is rubric; MORSHID. is primary. */
  tone: 'student' | 'morshid'
}

function SpeakerLabel({ children, tone }: SpeakerLabelProps) {
  return (
    <p
      className={cn(
        'smallcaps-label',
        tone === 'student' ? 'text-rubric!' : 'text-primary!',
      )}
    >
      {children}
    </p>
  )
}

/**
 * A superscript citation marker. The digit inherits `primary` from the parent
 * `<sup>`, so `.link-editorial` (which sets `color: inherit`) resolves to ink
 * blue without an important override.
 */
function Citation({ n, href }: { n: number; href: string }) {
  return (
    <sup className="ml-0.5 align-super text-[0.7em] font-medium text-primary">
      <a href={href} className="link-editorial">
        {n}
      </a>
    </sup>
  )
}

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-24 md:px-10 md:pt-28">
      <div className="grid gap-12 lg:grid-cols-12">
        {/* Left — cols 1–7 */}
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <span className="rubric-square" aria-hidden />
            <span className="smallcaps-label">
              A Socratic tutor, bound to your course
            </span>
          </div>

          <h1 className="mt-6 font-display text-[clamp(3.25rem,7vw,6.75rem)] leading-[1.02] font-semibold text-balance text-foreground">
            Every answer has a page number.
          </h1>

          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Morshid reads the syllabus, slides, and notes your professor
            actually assigned — then tutors you the Socratic way: asking before
            answering, and citing the page when it does.
          </p>

          <div className="mt-9 flex flex-wrap items-baseline gap-6">
            <Button
              nativeButton={false}
              render={<Link to="/login" />}
              size="lg"
            >
              Begin studying
            </Button>
            <a
              href="#method"
              className="link-editorial font-mono text-sm text-foreground"
            >
              Read the method ↓
            </a>
          </div>
        </div>

        {/* Right — cols 8–12: The transcript */}
        <div className="lg:col-span-5">
          <figure className="rounded-md border bg-card p-8">
            <figcaption className="flex items-center justify-between gap-4">
              <span className="smallcaps-label">
                Transcript — Data Structures, Week 8
              </span>
              <Logo iconClassName="size-5" className="size-5 text-foreground" />
            </figcaption>

            <div className="mt-6 space-y-5">
              <div className="motion-safe:animate-fade-up">
                <SpeakerLabel tone="student">Student.</SpeakerLabel>
                <p className="mt-1 font-display text-[1.25rem] leading-snug text-foreground italic">
                  Why does quicksort average O(n log n)?
                </p>
              </div>

              <div className="motion-safe:animate-fade-up [animation-delay:120ms]">
                <SpeakerLabel tone="morshid">Morshid.</SpeakerLabel>
                <p className="mt-1 leading-relaxed text-foreground">
                  Let us reason it out. If each pivot splits the array roughly
                  in half, how many times can you halve n before reaching 1?
                  <Citation n={1} href="#hero-fn-1" />
                </p>
              </div>

              <div className="motion-safe:animate-fade-up [animation-delay:240ms]">
                <SpeakerLabel tone="student">Student.</SpeakerLabel>
                <p className="mt-1 font-display text-[1.25rem] leading-snug text-foreground italic">
                  About log n times.
                </p>
              </div>

              <div className="motion-safe:animate-fade-up [animation-delay:360ms]">
                <SpeakerLabel tone="morshid">Morshid.</SpeakerLabel>
                <p className="mt-1 leading-relaxed text-foreground">
                  Exactly — and every level touches each element once. So what
                  is the total work?
                  <Citation n={2} href="#hero-fn-2" />
                </p>
              </div>
            </div>

            <div className="rule mt-6 space-y-1.5 pt-4">
              <p
                id="hero-fn-1"
                className="footnote motion-safe:animate-fade-in [animation-delay:480ms]"
              >
                1 — Lecture 08 · Quicksort — p. 12
              </p>
              <p
                id="hero-fn-2"
                className="footnote motion-safe:animate-fade-in [animation-delay:600ms]"
              >
                2 — Problem Set 3 · Analysis — p. 4
              </p>
            </div>
          </figure>
        </div>
      </div>
    </section>
  )
}
