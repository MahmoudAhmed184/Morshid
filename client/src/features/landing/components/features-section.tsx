import { BookOpen, Clock, MessageCircleQuestion, Quote } from 'lucide-react'

import { FeatureCard } from '@/features/landing/components/feature-card'

const features = [
  {
    icon: MessageCircleQuestion,
    title: 'Socratic Guidance',
    description:
      'Experience a tailored learning journey. The AI asks probing questions that guide you to discover the answers yourself, ensuring long-term retention.',
  },
  {
    icon: BookOpen,
    title: 'Course Grounded',
    description:
      'Upload your syllabus, lecture slides, and notes. Morshid stays strictly within the context of your specific curriculum, avoiding generic responses.',
  },
  {
    icon: Quote,
    title: 'Smart Citations',
    description:
      'Every explanation includes exact references to your uploaded course materials, so you can easily review the source material when needed.',
  },
  {
    icon: Clock,
    title: '24/7 Availability',
    description:
      'Your personal tutor is ready whenever you are. Late-night study sessions before finals are now fully supported with instant, patient guidance.',
  },
] as const

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="border-t border-border/60 bg-muted/30 bg-gradient-to-b from-primary/5 to-muted/30 py-20 sm:py-28"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="features-heading"
            className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Designed for Deep Understanding
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            We don&apos;t just give you the answers. We help you build the
            mental models required to ace your exams.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
