import {
  Cpu,
  FileText,
  Gauge,
  Palette,
  Shield,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import type { SettingsTabDescriptor } from '@/workspaces/_shared/settings-shell'

export const adminSettingsTabs: readonly SettingsTabDescriptor[] = [
  {
    id: 'account',
    label: 'Account',
    to: '/admin/settings/account',
    icon: UserRound,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    to: '/admin/settings/appearance',
    icon: Palette,
  },
  {
    id: 'usage',
    label: 'Usage',
    to: '/admin/settings/usage',
    icon: Gauge,
  },
  {
    id: 'review-policy',
    label: 'Review policy',
    to: '/admin/settings/review-policy',
    icon: ShieldCheck,
  },
  {
    id: 'materials',
    label: 'Materials & data',
    to: '/admin/settings/materials',
    icon: FileText,
  },
  {
    id: 'security',
    label: 'Security',
    to: '/admin/settings/security',
    icon: Shield,
  },
  {
    id: 'ai-capacity',
    label: 'AI capacity',
    to: '/admin/settings/ai-capacity',
    icon: Cpu,
  },
]
