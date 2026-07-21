import { useRef } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/providers/theme-provider'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
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
            variant="ghost"
            size="icon"
            className="rounded-full"
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
            {theme === 'system' ? <Check /> : <Monitor />}
            System
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
