import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from './support/demo-auth'

test.describe('Student session workspace', () => {
  test('preserves course and session navigation across responsive widths', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInThroughUi(page, demoAccounts.student)

    await page.goto('/student/courses')
    await page.getByRole('link', { name: 'Open AI Tutor' }).first().click()

    await expect(page).toHaveURL(/\/student\/ai-tutor\?courseId=/)
    await expect(
      page.getByRole('complementary', { name: 'Session navigation' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'New chat' })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(
      page.getByRole('complementary', { name: 'Session navigation' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'New chat' })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeDisabled()
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })
})
