import { Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatPreviewCard } from './chat-preview-card'
import { TrustLogosSection } from './trust-logos-section'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto w-full max-w-5xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20 sm:pb-24 lg:px-8">
        <Badge
          variant="outline"
          className="mx-auto h-7 gap-2 border-border bg-card px-4 py-1.5 text-muted-foreground"
        >
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          Morshid AI Tutor 2.0 is live
        </Badge>

        <h1 className="mt-8 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.08]">
          Master Your Courses with{' '}
          <span className="text-primary">Socratic AI</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Stop searching for answers. Start understanding them. Morshid guides
          you through complex university coursework using proven Socratic
          questioning techniques.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            nativeButton={false}
            render={<Link to="/login" />}
            size="lg"
            className="h-11 min-w-44 px-6"
          >
            Get Started for Free
          </Button>
          <Button variant="outline" size="lg" className="h-11 min-w-36 px-6">
            <Play className="size-4" aria-hidden />
            Watch Demo
          </Button>
        </div>

        <div className="relative mx-auto mt-14 max-w-3xl sm:mt-16">
          <div
            className="pointer-events-none absolute -inset-8 rounded-3xl bg-primary/10 blur-3xl"
            aria-hidden
          />
          <ChatPreviewCard />
        </div>

        <TrustLogosSection />
      </div>
    </section>
  )
}
