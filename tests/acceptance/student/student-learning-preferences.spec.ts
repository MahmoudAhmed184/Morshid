import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from '../support/demo-auth'

test.describe('Student Learning Preferences', () => {
  test('seeded Student navigates to learning settings and changes explanation detail level', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student)

    await page.goto('/settings/learning')

    await expect(page).toHaveURL(/\/settings\/learning/)
    await expect(
      page.getByRole('heading', { name: 'Explanation Detail' }),
    ).toBeVisible()

    // Verify Standard is initially selected
    const standardRadio = page.getByRole('radio', { name: /Standard/i })
    await expect(standardRadio).toBeVisible()
    await expect(standardRadio).toHaveAttribute('aria-checked', 'true')

    // Select Detailed
    const detailedRadio = page.getByRole('radio', { name: /Detailed/i })
    await detailedRadio.click()
    await expect(detailedRadio).toHaveAttribute('aria-checked', 'true')

    // Click Save changes
    const saveButton = page.getByRole('button', { name: 'Save changes' })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    // Verify save success alert
    await expect(
      page.getByText('Learning preferences updated successfully.'),
    ).toBeVisible()

    // Reload page to verify persistence
    await page.reload()
    await expect(
      page.getByRole('radio', { name: /Detailed/i }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})
