import { useRef } from 'react'
import { Check, Moon, Palette, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/providers/theme-provider'

const themePresets = [
  {
    value: 'default',
    label: 'Default',
    swatches: ['#4f46e5', '#8b5cf6', '#e2b04a'],
  },
  {
    value: 'slate',
    label: 'Slate',
    swatches: ['#475569', '#94a3b8', '#f8fafc'],
  },
  {
    value: 'emerald',
    label: 'Emerald',
    swatches: ['#10b981', '#a7f3d0', '#064e3b'],
  },
  {
    value: 'rose',
    label: 'Rose',
    swatches: ['#e11d48', '#fecdd3', '#4c0519'],
  },
  {
    value: 'amber',
    label: 'Amber',
    swatches: ['#d97706', '#fde68a', '#451a03'],
  },
] as const

export function ModeToggle() {
  const { theme, themePreset, setTheme, setThemePreset } = useTheme()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const getTransitionOrigin = () => {
    const rect = triggerRef.current?.getBoundingClientRect()

    if (!rect) return undefined

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={triggerRef}
        render={
          <Button
            variant="outline"
            className="h-8 gap-1.5 px-2.5"
            aria-label="Toggle theme"
          />
        }
      >
        <span className="relative size-4">
          <Sun className="absolute inset-0 size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute inset-0 size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </span>
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mode</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setTheme('light', getTransitionOrigin())}
          >
            {theme === 'light' ? <Check /> : <Sun />}
            Light
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('dark', getTransitionOrigin())}
          >
            {theme === 'dark' ? <Check /> : <Moon />}
            Dark
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme('system', getTransitionOrigin())}
          >
            {theme === 'system' ? <Check /> : <Palette />}
            System
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {themePresets.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() =>
                setThemePreset(preset.value, getTransitionOrigin())
              }
            >
              {themePreset === preset.value ? <Check /> : <Palette />}
              <span className="flex -space-x-1">
                {preset.swatches.map((color) => (
                  <span
                    key={color}
                    className="size-3.5 rounded-full border border-background ring-1 ring-border"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ))}
              </span>
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
