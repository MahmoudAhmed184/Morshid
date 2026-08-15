import { PageHeader } from '@/components/ui/custom/page-header'
import { AccountTabContent } from './account-tab-content'
import { AppearanceTabContent } from './appearance-tab-content'

export { AccountTabContent } from './account-tab-content'
export { AppearanceTabContent } from './appearance-tab-content'

export function AccountSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <PageHeader
        className="border-b-0 pb-1"
        eyebrow="Workspace"
        title="Settings"
        description="Manage your profile and workspace preferences."
      />
      <AccountTabContent />
      <AppearanceTabContent />
    </div>
  )
}
