import { BookOpen, Clock, MessageCircleQuestion, Quote } from 'lucide-react'

import { GuidingStar } from '@/components/guiding-star'
import { FeatureCard } from '@/features/landing/components/feature-card'

import { Reveal } from './reveal'

const features = [
  {
    icon: MessageCircleQuestion,
    title: 'Socratic Guidance',
    description:
      'Instead of handing over answers, Morshid asks the probing questions that lead you to discover them yourself — the kind of understanding that survives the exam.',
  },
  {
    icon: BookOpen,
    title: 'Grounded in Your Course',
    description:
      'Upload your syllabus, lecture slides, and notes. Every response stays strictly inside your curriculum — never a generic, off-topic answer.',
  },
  {
    icon: Quote,
    title: 'Cited by Source',
    description:
      'Each explanation links back to the exact page of your uploaded materials, so you can verify the reasoning and jump straight to the source.',
  },
  {
    icon: Clock,
    title: 'Always Available',
    description:
      'Your tutor is ready the night before finals and every hour in between — patient, consistent, and never rushed.',
  },
] as const

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative border-t border-border/60 bg-muted/25 py-20 sm:py-28"
      aria-labelledby="features-heading"
    >
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-primary">
            <GuidingStar className="size-3.5 text-gold" />
            Why Morshid
          </p>
          <h2
            id="features-heading"
            className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl"
          >
            An AI tutor that teaches from <span className="italic">your</span>{' '}
            material
          </h2>
          <p className="mt-4 text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
            No generic answers, no hallucinated facts. Morshid builds the mental
            models you need to master the course — grounded in exactly what your
            professor assigned.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 90}>
              <FeatureCard
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
