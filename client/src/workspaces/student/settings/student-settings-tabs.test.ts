import { describe, expect, it } from 'vitest'
import { studentSettingsTabs } from './student-settings-tabs'

describe('studentSettingsTabs', () => {
  it('exposes exactly the 5 approved student tabs in order', () => {
    expect(studentSettingsTabs.map((t) => t.label)).toEqual([
      'Account',
      'Appearance',
      'Learning & language',
      'Usage & reviews',
      'Security',
    ])
  })

  it('provides stable English slugs under /settings', () => {
    expect(studentSettingsTabs.map((t) => t.to)).toEqual([
      '/settings/account',
      '/settings/appearance',
      '/settings/learning',
      '/settings/usage',
      '/settings/security',
    ])
  })

  it('assigns unique identifiers and icons to every tab', () => {
    const ids = studentSettingsTabs.map((t) => t.id)
    expect(new Set(ids).size).toBe(5)
    expect(studentSettingsTabs.every((t) => t.icon !== undefined)).toBe(true)
  })
})
