import { MessagesSquare, Sparkles, Upload } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { GuidingStar } from '@/components/guiding-star'

import { Reveal } from './reveal'

type Step = {
  icon: LucideIcon
  step: string
  title: string
  description: string
}

const steps: readonly Step[] = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload your materials',
    description:
      'Add your syllabus, lecture slides, PDFs, and notes. Morshid reads and indexes everything your course covers.',
  },
  {
    icon: MessagesSquare,
    step: '02',
    title: 'Ask anything',
    description:
      'Pose a question in plain language. Morshid answers only from your materials and shows you the exact source.',
  },
  {
    icon: Sparkles,
    step: '03',
    title: 'Learn Socratically',
    description:
      'Rather than spoon-feeding, it guides you with questions — one step at a time — until the concept truly clicks.',
  },
] as const

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-t border-border/60 py-20 sm:py-28"
      aria-labelledby="how-it-works-heading"
    >
      <div
        className="bg-radial-spot pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-primary">
            <GuidingStar className="size-3.5 text-gold" />
            How it works
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl"
          >
            From your files to real understanding
          </h2>
          <p className="mt-4 text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
            Three steps stand between a stack of course files and a tutor that
            knows them cold.
          </p>
        </Reveal>

        <ol className="relative mt-16 grid gap-8 sm:gap-6 md:grid-cols-3">
          {/* Connecting line across steps on desktop. */}
          <div
            className="pointer-events-none absolute top-6 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden
          />

          {steps.map((step, index) => (
            <Reveal key={step.step} delay={index * 110}>
              <li className="relative flex flex-col items-center text-center">
                <div className="relative flex size-12 items-center justify-center rounded-2xl bg-card text-primary ring-1 ring-foreground/10 shadow-sm">
                  <step.icon className="size-5" aria-hidden />
                  <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.65rem] font-semibold text-primary-foreground shadow-xs">
                    {step.step}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
