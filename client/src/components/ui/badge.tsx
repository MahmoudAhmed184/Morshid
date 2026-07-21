import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 font-mono text-[0.6875rem] font-medium tracking-[0.08em] whitespace-nowrap uppercase transition-all focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default:
          'border-primary/25 bg-primary/10 text-primary [a]:hover:bg-primary/15',
        secondary:
          'border-border bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'border-destructive/25 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/15',
        rubric:
          'border-rubric/25 bg-rubric/10 text-rubric focus-visible:ring-rubric/20 dark:bg-rubric/20 [a]:hover:bg-rubric/15',
        success:
          'border-success/25 bg-success/10 text-success focus-visible:ring-success/20 dark:bg-success/18 [a]:hover:bg-success/15',
        warning:
          'border-warning/25 bg-warning/10 text-warning focus-visible:ring-warning/25 dark:bg-warning/20 [a]:hover:bg-warning/15',
        info: 'border-info/25 bg-info/10 text-info focus-visible:ring-info/20 dark:bg-info/18 [a]:hover:bg-info/15',
        outline:
          'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost:
          'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'link-editorial text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
