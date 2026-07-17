import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export const demoPassword = 'MorshidDemoP0!'

export const demoAccounts = {
  admin: { email: 'admin@morshid.demo' },
  instructor: { email: 'instructor@morshid.demo' },
  student: { email: 'student1@morshid.demo' },
  disabledStudent: { email: 'student3@morshid.demo' },
} as const

export type DemoAccount = (typeof demoAccounts)[keyof typeof demoAccounts]

export async function submitSignInForm(page: Page, account: DemoAccount) {
  await page.goto('/login')
  await page.getByLabel('Institutional Email').fill(account.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(demoPassword)
  await page.getByRole('button', { name: 'Sign In to Portal' }).click()
}

export async function signInThroughUi(page: Page, account: DemoAccount) {
  await submitSignInForm(page, account)
  await expect(page).not.toHaveURL(/\/login\/?$/)
}
