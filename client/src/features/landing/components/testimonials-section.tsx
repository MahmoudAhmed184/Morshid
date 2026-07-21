import { Star } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

import { Reveal } from './reveal'

const stats = [
  { value: '92%', label: 'report higher exam confidence' },
  { value: '4.9/5', label: 'average student rating' },
  { value: '120k+', label: 'questions guided, not answered' },
] as const

type Testimonial = {
  quote: string
  name: string
  detail: string
  initials: string
}

const testimonials: readonly Testimonial[] = [
  {
    quote:
      'It never just gives me the answer. It nudges me until I get there myself — and then I actually remember it during the exam.',
    name: 'Sara M.',
    detail: 'Computer Science, 2nd year',
    initials: 'SM',
  },
  {
    quote:
      'Every explanation points back to the exact lecture slide. I finally trust that what I am studying matches what my professor teaches.',
    name: 'Daniel K.',
    detail: 'Mechanical Engineering, 3rd year',
    initials: 'DK',
  },
] as const

function StarRating() {
  return (
    <div className="flex gap-0.5" aria-label="Five out of five stars">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className="size-4 fill-gold text-gold" aria-hidden />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section
      className="relative border-t border-border/60 bg-muted/25 py-20 sm:py-28"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2
            id="testimonials-heading"
            className="font-display text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl"
          >
            Loved by students who&apos;d rather{' '}
            <span className="italic">understand</span>
          </h2>
        </Reveal>

        <Reveal
          delay={80}
          className="mx-auto mt-12 grid max-w-4xl grid-cols-3 divide-x divide-border rounded-2xl bg-card ring-1 ring-foreground/8 shadow-sm"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-6 text-center sm:px-6">
              <p className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </Reveal>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {testimonials.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 90}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-5">
                  <StarRating />
                  <p className="flex-1 text-base leading-7 text-pretty text-foreground">
                    “{testimonial.quote}”
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {testimonial.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-muted-foreground">
                        {testimonial.detail}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
