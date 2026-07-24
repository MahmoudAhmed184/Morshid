import LogoLoop from '@/components/LogoLoop'

const universitiesRow1 = [
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        HARVARD UNIVERSITY
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        STANFORD
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        MIT
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        OXFORD
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        CAMBRIDGE
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        ETH ZÜRICH
      </span>
    ),
  },
]

const universitiesRow2 = [
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        UC BERKELEY
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        COLUMBIA
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        PRINCETON
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        YALE
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        TORONTO
      </span>
    ),
  },
  {
    node: (
      <span className="font-bold tracking-tight text-foreground/80 text-sm sm:text-base">
        IMPERIAL COLLEGE
      </span>
    ),
  },
]

export function TrustLogosSection() {
  return (
    <section className="border-y border-border/60 bg-muted/20 py-8 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Trusted by students from top institutions worldwide
        </p>
      </div>

      <div className="space-y-4">
        {/* Row 1: Left to right */}
        <LogoLoop
          logos={universitiesRow1}
          speed={35}
          direction="left"
          gap={48}
          fadeOut={true}
          pauseOnHover={true}
          enableDrag={true}
        />

        {/* Row 2: Right to left */}
        <LogoLoop
          logos={universitiesRow2}
          speed={35}
          direction="right"
          gap={48}
          fadeOut={true}
          pauseOnHover={true}
          enableDrag={true}
        />
      </div>
    </section>
  )
}
