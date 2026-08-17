import { Briefcase, Palette, Shield, UserRound } from 'lucide-react'

import type { SettingsTabDescriptor } from '@/workspaces/_shared/settings-shell'

export const instructorSettingsTabs: readonly SettingsTabDescriptor[] = [
  {
    id: 'account',
    label: 'Account',
    to: '/instructor/settings/account',
    icon: UserRound,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    to: '/instructor/settings/appearance',
    icon: Palette,
  },
  {
    id: 'workspace',
    label: 'Workspace',
    to: '/instructor/settings/workspace',
    icon: Briefcase,
  },
  {
    id: 'security',
    label: 'Security',
    to: '/instructor/settings/security',
    icon: Shield,
  },
]
