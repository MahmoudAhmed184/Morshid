import { Link } from '@tanstack/react-router'
import { ArrowRight, Play } from 'lucide-react'

import { GuidingStar } from '@/components/guiding-star'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { ChatPreviewCard } from './chat-preview-card'
import { TrustLogosSection } from './trust-logos-section'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered brand atmosphere: indigo spotlight, faint rule grid, star field. */}
      <div
        className="bg-radial-spot pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div
        className="bg-grid-faint pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]"
        aria-hidden
      />
      <div
        className="bg-star-field pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_55%)]"
        aria-hidden
      />

      {/* Floating gold star ornaments — sparing, decorative. */}
      <GuidingStar className="animate-float pointer-events-none absolute top-28 left-[8%] size-6 text-gold/40 motion-reduce:animate-none max-lg:hidden" />
      <GuidingStar className="animate-float pointer-events-none absolute top-52 right-[12%] size-4 text-primary/30 [animation-delay:1.5s] motion-reduce:animate-none max-lg:hidden" />
      <GuidingStar className="animate-float pointer-events-none absolute bottom-40 left-[14%] size-3.5 text-gold/30 [animation-delay:3s] motion-reduce:animate-none max-lg:hidden" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="animate-fade-in mx-auto h-7 gap-2 border-border/70 bg-card/70 px-3.5 py-1.5 text-muted-foreground backdrop-blur-sm"
          >
            <GuidingStar className="size-3 text-gold" />
            Grounded in your own course materials
          </Badge>

          <h1 className="animate-fade-up mt-7 font-display text-5xl leading-[1.04] font-semibold tracking-tight text-balance text-foreground [animation-delay:60ms] sm:text-6xl lg:text-7xl">
            Master your courses with{' '}
            <span className="text-gradient-brand italic">Socratic AI</span>
          </h1>

          <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-7 text-pretty text-muted-foreground [animation-delay:140ms] sm:text-lg">
            Morshid is an AI tutor that guides you through your own syllabus,
            slides, and notes — asking the right questions instead of handing
            over answers, and citing every source as it goes.
          </p>

          <div className="animate-fade-up mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:220ms] sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link to="/login" />}
              size="lg"
              className="shadow-glow-primary h-12 min-w-48 gap-2 px-6 text-base"
            >
              Start learning free
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              nativeButton={false}
              render={<a href="#how-it-works" />}
              variant="outline"
              size="lg"
              className="h-12 min-w-40 gap-2 px-6 text-base"
            >
              <Play className="size-4" aria-hidden />
              See how it works
            </Button>
          </div>
        </div>

        <div className="animate-fade-up relative mx-auto mt-16 max-w-3xl [animation-delay:320ms] sm:mt-20">
          <div
            className="pointer-events-none absolute -inset-x-12 -top-10 -bottom-6 rounded-2xl bg-primary/15 blur-3xl"
            aria-hidden
          />
          <ChatPreviewCard />
        </div>

        <TrustLogosSection />
      </div>
    </section>
  )
}
