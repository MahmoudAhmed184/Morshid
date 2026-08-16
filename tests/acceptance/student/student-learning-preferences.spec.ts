import { expect, test } from '@playwright/test'

import { apiBaseUrl, bearerHeaders, signInThroughApi } from '../support/api'
import { demoAccounts, signInThroughUi } from '../support/demo-auth'

test.describe('Student Learning Preferences', () => {
  test.beforeEach(async ({ request }) => {
    const studentAccessToken = await signInThroughApi(
      request,
      demoAccounts.student,
    )
    const resetResponse = await request.patch(
      `${apiBaseUrl}/api/v1/student/tutoring-preferences`,
      {
        data: { explanationDetailLevel: 'STANDARD' },
        headers: bearerHeaders(studentAccessToken),
      },
    )
    await expect(resetResponse).toBeOK()
  })

  test('seeded Student navigates to learning settings and changes explanation detail level', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student)
    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)

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
      page.getByRole('heading', { name: 'Explanation Detail' }),
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: /Detailed/i }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})
