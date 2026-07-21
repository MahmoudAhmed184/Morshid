import { GuidingStar } from '@/components/guiding-star'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

const educators = ['JD', 'AS', 'ML'] as const

type AuthBrandingPanelProps = {
  className?: string
}

export function AuthBrandingPanel({ className }: AuthBrandingPanelProps) {
  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between overflow-hidden border-r border-border/60 bg-card p-10 xl:p-14',
        className,
      )}
    >
      {/* Layered brand atmosphere — spotlight + tessellating star field. */}
      <div
        className="bg-radial-spot pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div
        className="bg-star-field pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
        aria-hidden
      />
      <GuidingStar className="animate-float pointer-events-none absolute top-16 right-14 size-6 text-gold/40 motion-reduce:animate-none" />
      <GuidingStar className="animate-float pointer-events-none absolute bottom-40 left-16 size-4 text-primary/25 [animation-delay:2s] motion-reduce:animate-none" />

      <div className="relative flex items-center gap-2.5">
        <Logo />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Morshid
        </span>
      </div>

      <div className="relative max-w-md space-y-6">
        <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-foreground xl:text-6xl">
          The future of{' '}
          <span className="text-gradient-brand italic">academic</span>{' '}
          intelligence.
        </h1>
        <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          A specialized ecosystem that turns course materials into a patient,
          Socratic guide — for the educators who shape them and the students who
          learn from them.
        </p>

        <figure className="surface-glass max-w-sm rounded-2xl border border-border/60 p-5 shadow-sm">
          <blockquote className="text-sm leading-6 text-foreground">
            “Morshid feels less like a search engine and more like a colleague
            who has read every page of my syllabus.”
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                RH
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              Dr. Rana H. · Faculty of Engineering
            </span>
          </figcaption>
        </figure>
      </div>

      <div className="relative flex items-center gap-4">
        <div className="flex -space-x-2">
          {educators.map((initials) => (
            <Avatar key={initials} className="ring-2 ring-card">
              <AvatarFallback className="bg-secondary text-[11px] font-semibold text-secondary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Trusted by educators and students alike
        </p>
      </div>
    </aside>
  )
}
