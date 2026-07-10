import { Avatar, AvatarFallback, AvatarGroup } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

const educatorAvatars = ['JD', 'AS', 'ML'] as const

type AuthBrandingPanelProps = {
  className?: string
}

export function AuthBrandingPanel({ className }: AuthBrandingPanelProps) {
  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between overflow-hidden border-r border-border/60 bg-background p-10 xl:p-14',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_70%)] opacity-15"
        aria-hidden
      />

      <Logo className="relative" />

      <div className="relative max-w-md space-y-5">
        <h1 className="text-5xl leading-tight font-semibold tracking-tight text-foreground xl:text-6xl">
          The Future of <span className="text-primary italic">Academic</span>{' '}
          Intelligence.
        </h1>
        <p className="text-base leading-relaxed text-foreground sm:text-lg">
          A specialized ecosystem designed to empower educators with
          high-fidelity analytical tools and streamlined academic management.
        </p>
      </div>

      <AvatarGroup className="relative">
        {educatorAvatars.map((initials) => (
          <Avatar key={initials} size="sm">
            <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
    </aside>
  )
}
