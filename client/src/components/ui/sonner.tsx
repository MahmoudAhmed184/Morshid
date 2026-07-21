import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'
import type { ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'color-mix(in oklab, var(--popover) 78%, transparent)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border':
            'color-mix(in oklab, var(--foreground) 12%, transparent)',
          '--border-radius': '2rem',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast glass-paper shadow-md',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
