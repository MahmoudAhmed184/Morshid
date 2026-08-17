import { SettingsShell } from '@/workspaces/_shared/settings-shell'
import { studentSettingsTabs } from './student-settings-tabs'

export function StudentSettingsLayout() {
  return (
    <SettingsShell
      eyebrow="Workspace"
      title="Settings"
      description="Manage your profile and workspace preferences."
      tabs={studentSettingsTabs}
    />
  )
}
