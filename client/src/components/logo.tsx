import { GraduationCap } from 'lucide-react'

import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
  iconClassName?: string
}

export function Logo({ className, iconClassName }: LogoProps) {
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
