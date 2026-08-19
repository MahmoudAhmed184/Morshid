import { Palette, Shield, UserRound } from 'lucide-react'

import type { SettingsTabDescriptor } from '@/workspaces/_shared/settings-shell'

export const superAdminSettingsTabs: readonly SettingsTabDescriptor[] = [
  {
    id: 'account',
    label: 'Account',
    to: '/super-admin/settings/account',
    icon: UserRound,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    to: '/super-admin/settings/appearance',
    icon: Palette,
  },
  {
    id: 'security',
    label: 'Security',
    to: '/super-admin/settings/security',
    icon: Shield,
  },
]
