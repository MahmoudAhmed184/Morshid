import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * The RuledField input — the auth-surface variant of the boxed {@link Input}.
 *
 * Per the editorial spec (§4/§6), auth fields are set as ruled lines rather
 * than boxes: a single hairline underline that inks to `foreground` (2px) on
 * focus and to `rubric` on error, with no focus ring. This is a local restyle
 * of the shared primitive — it does not fork it — so all input behavior,
 * ref-forwarding, and aria wiring flow straight through.
 */
const ruledFieldInputClassName =
  'h-11 rounded-none border-0 border-b px-0 py-0 md:text-base hover:border-foreground/40 focus-visible:border-b-2 focus-visible:border-foreground focus-visible:ring-0 aria-invalid:border-rubric aria-invalid:ring-0 disabled:bg-transparent dark:bg-transparent dark:aria-invalid:border-rubric dark:disabled:bg-transparent'

export const RuledFieldInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(function RuledFieldInputControl({ className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      className={cn(ruledFieldInputClassName, className)}
      {...props}
    />
  )
})
