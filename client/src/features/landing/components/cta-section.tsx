import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { GuidingStar } from '@/components/guiding-star'
import { Button } from '@/components/ui/button'

import { Reveal } from './reveal'

export function CtaSection() {
  return (
    <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <Reveal className="mx-auto w-full max-w-5xl">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center ring-1 ring-primary/40 shadow-2xl sm:px-12 sm:py-20">
          <div
            className="bg-star-field pointer-events-none absolute inset-0 opacity-30 [--star-size:44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
            aria-hidden
          />
          <div
            className="animate-aurora pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,oklch(0.56_0.2_305/0.5),transparent)] bg-[length:200%_100%] opacity-60 motion-reduce:animate-none"
            aria-hidden
          />

          <div className="relative">
            <GuidingStar className="animate-float mx-auto size-7 text-gold motion-reduce:animate-none" />
            <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-balance text-primary-foreground sm:text-5xl">
              Meet the tutor who guides you home
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-pretty text-primary-foreground/85 sm:text-lg">
              Turn your course materials into a patient, Socratic guide. Free to
              start — no credit card, no setup.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                variant="secondary"
                size="lg"
                className="h-12 min-w-48 gap-2 px-6 text-base shadow-lg"
              >
                Start learning free
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                nativeButton={false}
                render={<a href="#features" />}
                variant="ghost"
                size="lg"
                className="h-12 min-w-40 px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Explore features
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
