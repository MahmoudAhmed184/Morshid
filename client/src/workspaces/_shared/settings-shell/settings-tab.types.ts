import type { LucideIcon } from 'lucide-react'

export type SettingsTabDescriptor = {
  readonly id: string
  readonly label: string
  readonly to: string
  readonly exact?: boolean
  readonly icon?: LucideIcon
}
