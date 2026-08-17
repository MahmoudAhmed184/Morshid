import { describe, expect, it } from 'vitest'
import { adminSettingsTabs } from './admin-settings-tabs'

describe('adminSettingsTabs', () => {
  it('exposes exactly the 7 approved admin tabs in order', () => {
    expect(adminSettingsTabs.map((t) => t.label)).toEqual([
      'Account',
      'Appearance',
      'Usage',
      'Review policy',
      'Materials & data',
      'Security',
      'AI capacity',
    ])
  })

  it('provides stable English slugs under /admin/settings', () => {
    expect(adminSettingsTabs.map((t) => t.to)).toEqual([
      '/admin/settings/account',
      '/admin/settings/appearance',
      '/admin/settings/usage',
      '/admin/settings/review-policy',
      '/admin/settings/materials',
      '/admin/settings/security',
      '/admin/settings/ai-capacity',
    ])
  })

  it('assigns unique identifiers and icons to every tab', () => {
    const ids = adminSettingsTabs.map((t) => t.id)
    expect(new Set(ids).size).toBe(7)
    expect(adminSettingsTabs.every((t) => t.icon !== undefined)).toBe(true)
  })
})
