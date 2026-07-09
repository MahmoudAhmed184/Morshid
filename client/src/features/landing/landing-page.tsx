import { FeaturesSection } from './components/features-section'
import { HeroSection } from './components/hero-section'
import { LandingFooter } from './components/landing-footer'
import { LandingNavbar } from './components/landing-navbar'

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </main>
      <LandingFooter />
    </div>
  )
}
