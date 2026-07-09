const trustLogos = [
  { name: 'AWS', label: 'aws' },
  { name: 'Google', label: 'Google' },
  { name: 'Microsoft', label: 'Microsoft' },
  { name: 'Meta', label: 'Meta' },
  { name: 'Apple', label: 'Apple' },
] as const

export function TrustLogosSection() {
  return (
    <div className="mt-20 border-t border-border/60 pt-12 sm:mt-24">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Trusted by students at top universities
      </p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
        {trustLogos.map((logo) => (
          <li
            key={logo.name}
            className="text-lg font-semibold tracking-tight text-muted-foreground/50 select-none sm:text-xl"
            aria-label={logo.name}
          >
            {logo.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
