import { Activity, BookOpen, Palette, Shield, UserRound } from 'lucide-react'

import type { SettingsTabDescriptor } from '@/workspaces/_shared/settings-shell'

export const studentSettingsTabs: readonly SettingsTabDescriptor[] = [
  {
    id: 'account',
    label: 'Account',
    to: '/settings/account',
    icon: UserRound,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    to: '/settings/appearance',
    icon: Palette,
  },
  {
    id: 'learning',
    label: 'Learning & language',
    to: '/settings/learning',
    icon: BookOpen,
  },
  {
    id: 'usage',
    label: 'Usage & reviews',
    to: '/settings/usage',
    icon: Activity,
  },
  {
    id: 'security',
    label: 'Security',
    to: '/settings/security',
    icon: Shield,
  },
]
