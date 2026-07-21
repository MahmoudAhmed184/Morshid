import { Footer } from '#/components/layout/footer'
import { Navbar } from '#/components/layout/navbar'
import { CtaSection } from './components/cta-section'
import { FeaturesSection } from './components/features-section'
import { HeroSection } from './components/hero-section'
import { HowItWorksSection } from './components/how-it-works-section'
import { TestimonialsSection } from './components/testimonials-section'

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
