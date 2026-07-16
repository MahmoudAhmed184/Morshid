import { DashboardSettingsPage } from '@/components/layout/dashboard-settings-page'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/custom/page-header'

export function InstructorSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge variant="secondary">Instructor workspace</Badge>}
        title="Settings"
        description="Manage your profile and workspace preferences."
      />
      <DashboardSettingsPage roleName="Instructor" embedded />
    </div>
  )
}
