import { ColophonCtaSection } from './components/colophon-cta-section'
import { CourseSection } from './components/course-section'
import { CredoStrip } from './components/credo-strip'
import { Footer } from './components/footer'
import { HeroSection } from './components/hero-section'
import { MarginaliaSection } from './components/marginalia-section'
import { MethodSection } from './components/method-section'
import { Navbar } from './components/navbar'

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pt-28">
        <HeroSection />
        <CredoStrip />
        <MethodSection />
        <CourseSection />
        <MarginaliaSection />
        <ColophonCtaSection />
      </main>
      <Footer />
    </div>
  )
}
