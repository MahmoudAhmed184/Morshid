import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useTheme } from '@/components/theme/theme-provider'
import type { ThemeMode, ThemePalette } from '@/components/theme/theme-provider'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const modeOptions: readonly {
  value: ThemeMode
  label: string
  icon: LucideIcon
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const paletteOptions: readonly {
  value: ThemePalette
  label: string
  colors: readonly [string, string, string, string]
  darkPreview?: boolean
}[] = [
  {
    value: 'morshid',
    label: 'Morshid',
    colors: ['#f4f6f8', '#ffffff', '#04677f', '#eaf5f8'],
  },
  {
    value: 'ocean-mist',
    label: 'Ocean Mist',
    colors: ['#f2f8f9', '#ffffff', '#1593a5', '#dceff2'],
  },
  {
    value: 'slate-blue',
    label: 'Slate Blue',
    colors: ['#f3f6fb', '#ffffff', '#4f78b8', '#e4ebf7'],
  },
  {
    value: 'lavender-gray',
    label: 'Lavender Gray',
    colors: ['#f7f5fa', '#ffffff', '#7563a8', '#ece8f4'],
  },
  {
    value: 'soft-mint',
    label: 'Soft Mint',
    colors: ['#f3f8f5', '#ffffff', '#3f9276', '#e2f1e9'],
  },
  {
    value: 'dusk',
    label: 'Dusk',
    colors: ['#20283b', '#2a344a', '#91a9ff', '#3a4660'],
    darkPreview: true,
  },
]

function getTransitionOrigin(element: HTMLElement) {
  const bounds = element.getBoundingClientRect()
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  }
}

export function AppearanceTabContent() {
  const { theme, palette, setTheme, setPalette } = useTheme()

  return (
    <Card className="-mx-4 rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
      <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
            <Palette className="size-4 text-muted-foreground" aria-hidden />
            Appearance
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Customize how Morshid looks on this device.
          </p>
        </div>

        <div
          data-slot="appearance-mode-row"
          className="mt-5 grid gap-4 border-b border-border/70 pb-5 xl:grid-cols-[12rem_1fr] xl:items-center"
        >
          <div>
            <h3 className="text-sm font-medium text-foreground">Mode</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Choose your preferred display mode.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 sm:max-w-md">
            {modeOptions.map((option, index) => {
              const Icon = option.icon
              const isActive = theme === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={(event) =>
                    setTheme(
                      option.value,
                      getTransitionOrigin(event.currentTarget),
                    )
                  }
                  className={cn(
                    'flex h-11 cursor-pointer items-center justify-center gap-2 border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors first:rounded-l-lg last:rounded-r-lg not-first:-ml-px hover:z-10 hover:text-foreground focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring',
                    isActive &&
                      'z-10 border-primary bg-accent text-accent-foreground shadow-xs',
                    index === 0 && 'rounded-l-lg',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div
          data-slot="appearance-palette-row"
          className="mt-5 grid gap-4 xl:grid-cols-[12rem_1fr]"
        >
          <div>
            <h3 className="text-sm font-medium text-foreground">Color theme</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pick the theme that inspires you.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paletteOptions.map((option) => {
              const isActive = palette === option.value
              const [canvas, surface, accent, tint] = option.colors

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={(event) =>
                    setPalette(
                      option.value,
                      getTransitionOrigin(event.currentTarget),
                    )
                  }
                  className={cn(
                    'group cursor-pointer overflow-hidden rounded-xl border bg-background text-left shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isActive
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border',
                  )}
                >
                  <ThemePreview
                    canvas={canvas}
                    surface={surface}
                    accent={accent}
                    tint={tint}
                  />
                  <span
                    className={cn(
                      'flex items-center gap-2 border-t border-border/70 px-3 py-2 text-sm font-medium',
                      option.darkPreview
                        ? 'bg-[#f8fafc] text-[#253047]'
                        : 'bg-background text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-full border',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background',
                      )}
                      aria-hidden
                    >
                      {isActive ? <Check className="size-3" /> : null}
                    </span>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ThemePreview({
  canvas,
  surface,
  accent,
  tint,
}: {
  canvas: string
  surface: string
  accent: string
  tint: string
}) {
  return (
    <span
      className="flex h-20 gap-2 p-2"
      style={{ backgroundColor: canvas }}
      aria-hidden
    >
      <span
        className="flex w-1/4 flex-col gap-1 rounded-md p-1.5"
        style={{ backgroundColor: tint }}
      >
        <span
          className="h-1.5 w-3/4 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="h-1.5 w-full rounded-full bg-white/60" />
        <span className="h-1.5 w-2/3 rounded-full bg-white/60" />
      </span>
      <span
        className="flex flex-1 flex-col justify-between rounded-md p-2 shadow-xs"
        style={{ backgroundColor: surface }}
      >
        <span
          className="h-2 w-full rounded-full"
          style={{ backgroundColor: tint }}
        />
        <span className="flex gap-1.5">
          <span
            className="h-2 w-2/5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span
            className="h-2 w-1/4 rounded-full"
            style={{ backgroundColor: tint }}
          />
        </span>
      </span>
    </span>
  )
}
