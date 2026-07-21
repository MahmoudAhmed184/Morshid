import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-xl border border-transparent bg-secondary/60 px-4 py-2.5 text-base text-foreground transition-[color,box-shadow,border-color,background-color] outline-none placeholder:text-muted-foreground/70 focus-visible:border-input focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-rubric aria-invalid:ring-2 aria-invalid:ring-rubric/25 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
