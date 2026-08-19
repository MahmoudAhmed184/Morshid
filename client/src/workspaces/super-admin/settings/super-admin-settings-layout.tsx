import { SettingsShell } from '@/workspaces/_shared/settings-shell'
import { superAdminSettingsTabs } from './super-admin-settings-tabs'

export function SuperAdminSettingsLayout() {
  return (
    <SettingsShell
      eyebrow="Platform"
      title="Settings"
      description="Manage your super administrator account profile and system preferences."
      tabs={superAdminSettingsTabs}
    />
  )
}
