import { FeaturesSection } from './components/features-section'
import { HeroSection } from './components/hero-section'

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </main>
    </div>
  )
}
