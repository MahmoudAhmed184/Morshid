// Fictional, education-flavored institution wordmarks — deliberately generic so
// they read as illustrative social proof rather than real-brand endorsements.
const institutions = [
  'Qurtuba Institute of Technology',
  'Al-Bayan University',
  'Northgate Polytechnic',
  'Cordoba State University',
  'Marefa College',
] as const

export function TrustLogosSection() {
  return (
    <div className="mt-20 sm:mt-24">
      <p className="text-center text-xs font-medium tracking-[0.2em] text-muted-foreground/80 uppercase">
        Trusted by students at leading institutions
      </p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
        {institutions.map((name) => (
          <li
            key={name}
            className="text-sm font-semibold tracking-tight whitespace-nowrap text-muted-foreground/45 transition-colors duration-300 select-none hover:text-muted-foreground/70 sm:text-base"
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
