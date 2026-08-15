import { SettingsShell } from '@/workspaces/_shared/settings-shell'
import { instructorSettingsTabs } from './instructor-settings-tabs'

export function InstructorSettingsLayout() {
  return (
    <SettingsShell
      eyebrow="Workspace"
      title="Settings"
      description="Manage your profile and workspace preferences."
      tabs={instructorSettingsTabs}
    />
  )
}
