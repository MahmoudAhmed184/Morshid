import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export function ColophonCtaSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-0 py-4 sm:px-6 sm:py-16 md:px-10 md:py-24">
      <div className="-mx-4 rounded-none border-x-0 border-y border-foreground/10 bg-foreground px-8 py-10 text-background shadow-2xl sm:-mx-6 sm:px-12 sm:py-16 md:mx-0 md:rounded-3xl md:border-x md:px-16">
        <div className="grid grid-cols-1 items-end gap-6 sm:gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Bring the course. Keep the understanding.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-background/80 sm:mt-5 sm:text-xl">
              For students on any course an instructor has shelved.
            </p>
          </div>
          <div className="flex lg:col-span-4 lg:justify-end">
            <Button
              nativeButton={false}
              render={<Link to="/login" />}
              size="lg"
              className="h-12 gap-2 rounded-full px-8 text-base font-semibold bg-background text-foreground hover:bg-background/90 hover:text-foreground sm:h-14 sm:px-9 sm:text-lg"
            >
              Begin studying
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
