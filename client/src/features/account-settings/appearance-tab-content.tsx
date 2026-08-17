import {
  Check,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Type,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useTheme } from '@/components/theme/theme-provider'
import type {
  Density,
  MotionPreference,
  TextScale,
  ThemeMode,
  ThemePalette,
} from '@/components/theme/theme-provider'
import { Button } from '@/components/ui/button'
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

const textScaleOptions: readonly {
  value: TextScale
  label: string
  sublabel: string
  ariaLabel: string
}[] = [
  {
    value: '90%',
    label: '90%',
    sublabel: 'Compact',
    ariaLabel: '90% text scale',
  },
  {
    value: '100%',
    label: '100%',
    sublabel: 'Default',
    ariaLabel: '100% text scale',
  },
  {
    value: '112%',
    label: '112%',
    sublabel: 'Large',
    ariaLabel: '112% text scale',
  },
]

const densityOptions: readonly {
  value: Density
  label: string
  sublabel: string
  ariaLabel: string
}[] = [
  {
    value: 'comfortable',
    label: 'Comfortable',
    sublabel: 'Spacious',
    ariaLabel: 'Comfortable density',
  },
  {
    value: 'compact',
    label: 'Compact',
    sublabel: 'Tighter',
    ariaLabel: 'Compact density',
  },
]

const motionOptions: readonly {
  value: MotionPreference
  label: string
  sublabel: string
  ariaLabel: string
}[] = [
  {
    value: 'system',
    label: 'Follow system',
    sublabel: 'OS setting',
    ariaLabel: 'Follow system motion',
  },
  {
    value: 'reduce',
    label: 'Reduce motion',
    sublabel: 'Minimal',
    ariaLabel: 'Reduce motion',
  },
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
  const {
    theme,
    palette,
    textScale,
    density,
    motion,
    setTheme,
    setPalette,
    setTextScale,
    setDensity,
    setMotion,
    resetAppearance,
  } = useTheme()

  return (
    <Card className="-mx-4 rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
      <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <Palette className="size-4 text-muted-foreground" aria-hidden />
              Appearance & accessibility
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Customize how Morshid looks, scales, and animates on this device.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetAppearance}
            className="self-start gap-1.5"
            aria-label="Reset to defaults"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset to defaults
          </Button>
        </div>

        {/* Display Mode */}
        <div
          data-slot="appearance-mode-row"
          className="mt-5 grid gap-4 border-b border-border/70 pb-5 xl:grid-cols-[12rem_1fr] xl:items-center"
        >
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Display mode
            </h3>
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
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Color Palettes */}
        <div
          data-slot="appearance-palette-row"
          className="mt-5 grid gap-4 border-b border-border/70 pb-5 xl:grid-cols-[12rem_1fr] xl:items-start"
        >
          <div className="xl:pt-1">
            <h3 className="text-sm font-medium text-foreground">Color theme</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Select an accent palette.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {paletteOptions.map((option) => {
              const isActive = palette === option.value
              const [canvas, surface, primaryColor, accentColor] = option.colors

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={isActive}
                  onClick={(event) =>
                    setPalette(
                      option.value,
                      getTransitionOrigin(event.currentTarget),
                    )
                  }
                  className={cn(
                    'group/palette flex cursor-pointer flex-col gap-2.5 rounded-lg border border-border bg-background p-3 text-left transition-all hover:border-foreground/30 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-ring',
                    isActive &&
                      'border-primary ring-2 ring-primary/20 bg-accent/30 shadow-xs',
                  )}
                >
                  <div
                    className={cn(
                      'relative flex h-14 w-full overflow-hidden rounded-md border border-black/10 p-2 shadow-inner transition-transform group-hover/palette:scale-[1.02]',
                      option.darkPreview && 'border-white/10',
                    )}
                    style={{ backgroundColor: canvas }}
                  >
                    <div
                      className="flex flex-1 flex-col justify-between rounded-sm p-1.5 shadow-xs"
                      style={{ backgroundColor: surface }}
                    >
                      <div className="flex items-center gap-1">
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                        <div
                          className="h-1.5 w-8 rounded-full"
                          style={{ backgroundColor: accentColor }}
                        />
                      </div>
                      <div
                        className="h-1.5 w-12 rounded-full opacity-60"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </div>
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                        <Check className="size-2.5 stroke-[3]" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {option.label}
                    </span>
                    {isActive && (
                      <span className="text-[0.6875rem] font-medium text-primary">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Text Scale */}
        <div
          data-slot="appearance-text-scale-row"
          className="mt-5 grid gap-4 border-b border-border/70 pb-5 xl:grid-cols-[12rem_1fr] xl:items-center"
        >
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Type className="size-4 text-muted-foreground" aria-hidden />
              Text scale
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Scale text size across all views.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 sm:max-w-md">
            {textScaleOptions.map((option, index) => {
              const isActive = textScale === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.ariaLabel}
                  aria-pressed={isActive}
                  onClick={() => setTextScale(option.value)}
                  className={cn(
                    'flex h-11 cursor-pointer flex-col items-center justify-center border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors first:rounded-l-lg last:rounded-r-lg not-first:-ml-px hover:z-10 hover:text-foreground focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring',
                    isActive &&
                      'z-10 border-primary bg-accent text-accent-foreground shadow-xs',
                    index === 0 && 'rounded-l-lg',
                  )}
                >
                  <span>{option.label}</span>
                  <span className="text-[0.6875rem] font-normal text-muted-foreground">
                    {option.sublabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Density */}
        <div
          data-slot="appearance-density-row"
          className="mt-5 grid gap-4 border-b border-border/70 pb-5 xl:grid-cols-[12rem_1fr] xl:items-center"
        >
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <LayoutGrid
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              Density
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Adjust spacing and layout compactness.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 sm:max-w-md">
            {densityOptions.map((option, index) => {
              const isActive = density === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.ariaLabel}
                  aria-pressed={isActive}
                  onClick={() => setDensity(option.value)}
                  className={cn(
                    'flex h-11 cursor-pointer flex-col items-center justify-center border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors first:rounded-l-lg last:rounded-r-lg not-first:-ml-px hover:z-10 hover:text-foreground focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring',
                    isActive &&
                      'z-10 border-primary bg-accent text-accent-foreground shadow-xs',
                    index === 0 && 'rounded-l-lg',
                  )}
                >
                  <span>{option.label}</span>
                  <span className="text-[0.6875rem] font-normal text-muted-foreground">
                    {option.sublabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Motion */}
        <div
          data-slot="appearance-motion-row"
          className="mt-5 grid gap-4 xl:grid-cols-[12rem_1fr] xl:items-center"
        >
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Zap className="size-4 text-muted-foreground" aria-hidden />
              Motion
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Control transitions and animated reveals.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 sm:max-w-md">
            {motionOptions.map((option, index) => {
              const isActive = motion === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.ariaLabel}
                  aria-pressed={isActive}
                  onClick={() => setMotion(option.value)}
                  className={cn(
                    'flex h-11 cursor-pointer flex-col items-center justify-center border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors first:rounded-l-lg last:rounded-r-lg not-first:-ml-px hover:z-10 hover:text-foreground focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring',
                    isActive &&
                      'z-10 border-primary bg-accent text-accent-foreground shadow-xs',
                    index === 0 && 'rounded-l-lg',
                  )}
                >
                  <span>{option.label}</span>
                  <span className="text-[0.6875rem] font-normal text-muted-foreground">
                    {option.sublabel}
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
