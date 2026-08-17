import { describe, expect, it } from 'vitest'
import { instructorSettingsTabs } from './instructor-settings-tabs'

describe('instructorSettingsTabs', () => {
  it('exposes exactly the 4 approved instructor tabs in order', () => {
    expect(instructorSettingsTabs.map((t) => t.label)).toEqual([
      'Account',
      'Appearance',
      'Workspace',
      'Security',
    ])
  })

  it('provides stable English slugs under /instructor/settings', () => {
    expect(instructorSettingsTabs.map((t) => t.to)).toEqual([
      '/instructor/settings/account',
      '/instructor/settings/appearance',
      '/instructor/settings/workspace',
      '/instructor/settings/security',
    ])
  })

  it('assigns unique identifiers and icons to every tab', () => {
    const ids = instructorSettingsTabs.map((t) => t.id)
    expect(new Set(ids).size).toBe(4)
    expect(instructorSettingsTabs.every((t) => t.icon !== undefined)).toBe(true)
  })
})
