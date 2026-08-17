import { SettingsShell } from '@/workspaces/_shared/settings-shell'
import { adminSettingsTabs } from './admin-settings-tabs'

export function AdminSettingsLayout() {
  return (
    <SettingsShell
      eyebrow="Workspace"
      title="Settings"
      description="Manage your profile and workspace preferences."
      tabs={adminSettingsTabs}
    />
  )
}
