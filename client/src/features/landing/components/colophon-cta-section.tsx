import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export function ColophonCtaSection() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-end gap-10 px-6 py-24 md:px-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <h2 className="font-display text-[clamp(2.25rem,4vw,3.75rem)] leading-[1.05] font-semibold text-balance">
            Bring the course. Keep the understanding.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-background/70">
            Free for students on any course an instructor has shelved.
          </p>
        </div>
        <div className="flex lg:col-span-4 lg:justify-end">
          <Button
            nativeButton={false}
            render={<Link to="/login" />}
            size="lg"
            className="bg-background text-foreground hover:bg-primary hover:text-primary-foreground"
          >
            Begin studying
          </Button>
        </div>
      </div>
    </section>
  )
}
