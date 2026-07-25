import { Reveal } from '@/features/landing/components/reveal'
import { Step, Stepper } from '@/features/landing/components/stepper'

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
      className="mx-auto w-full max-w-6xl scroll-mt-32 px-4 py-8 sm:px-6 sm:py-16 md:px-10 md:py-24"
    >
      <Reveal>
        <header>
          <div className="flex items-center gap-3">
            <span className="display-index leading-none">03</span>
            <span className="rubric-square" aria-hidden />
            <span className="smallcaps-label">From shelf to session</span>
          </div>
          <h2 className="display-2 mt-5 max-w-[20ch] text-balance text-foreground">
            Three steps, then it knows the course.
          </h2>
        </header>

        {/* Desktop Layout — 3 Columns Grid */}
        <div className="rule mt-16 hidden grid-cols-3 gap-10 pt-10 md:grid">
          {steps.map((step) => (
            <div key={step.title}>
              <p className="display-3 leading-none text-muted-foreground">
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

        {/* Mobile Layout — Interactive Stepper (Edge-to-Edge) */}
        <div className="mt-8 -mx-6 sm:-mx-10 md:hidden">
          <Stepper
            className="!p-0"
            stepCircleContainerClassName="!w-full !max-w-none !rounded-none !border-x-0 !border-y !shadow-none"
            contentClassName="!px-4"
          >
            {steps.map((step) => (
              <Step key={step.title}>
                <div className="py-2 text-center">
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                    {step.prose}
                  </p>
                </div>
              </Step>
            ))}
          </Stepper>
        </div>
      </Reveal>
    </section>
  )
}
