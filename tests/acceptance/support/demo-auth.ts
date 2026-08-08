import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export const demoPassword = 'MorshidDemoP0!'

export const demoAccounts = {
  admin: { email: 'admin@morshid.demo' },
  instructor: { email: 'instructor@morshid.demo' },
  student: { email: 'student1@morshid.demo' },
  student2: { email: 'student2@morshid.demo' },
  reviewStudent: { email: 'student2@morshid.demo' },
  disabledStudent: { email: 'student3@morshid.demo' },
} as const

export interface DemoAccount {
  readonly email: string
}

// The Playwright web server runs the client through `vite dev`, so
// `client/src/routes/__root.tsx` always mounts the TanStack Devtools trigger.
// It is a fixed bottom-right button that sits directly on top of the chat
// composer's Send button at phone widths and swallows the click. The devtools
// read their settings from this localStorage key before first paint, and stored
// settings win over the mounted `config`, so hiding the trigger here keeps the
// dev-only overlay out of the way without touching application code.
const devtoolsSettingsStorageKey = 'tanstack_devtools_settings'

export async function hideDevtoolsOverlay(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // Storage is unavailable on `about:blank`; the next navigation retries.
      }
    },
    [devtoolsSettingsStorageKey, JSON.stringify({ triggerHidden: true })],
  )
}

export async function submitSignInForm(page: Page, account: DemoAccount) {
  await hideDevtoolsOverlay(page)
  await page.goto('/login')
  await page.getByLabel('Institutional Email').fill(account.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(demoPassword)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

export async function signInThroughUi(page: Page, account: DemoAccount) {
  await submitSignInForm(page, account)
  await expect(page).not.toHaveURL(/\/login\/?$/)
}
