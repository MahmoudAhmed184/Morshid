import { DashboardSettingsPage } from '@/components/layout/dashboard-settings-page'
import { PageHeader } from '@/components/ui/custom/page-header'

export function InstructorSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Instructor workspace"
        title="Settings"
        description="Manage your profile and workspace preferences."
      />
      <DashboardSettingsPage roleName="Instructor" embedded />
    </div>
  )
}
