import { GraduationCap } from 'lucide-react'

import { cn } from '@/lib/utils'

type AuthLogoProps = {
  className?: string
  iconClassName?: string
}

export function AuthLogo({ className, iconClassName }: AuthLogoProps) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background',
        className,
      )}
    >
      <GraduationCap className={cn('size-5', iconClassName)} aria-hidden />
    </div>
  )
}
