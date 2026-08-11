import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from '../support/demo-auth'

test('seeded Student signs in through the UI and reaches the Student shell', async ({
  page,
}) => {
  await signInThroughUi(page, demoAccounts.student)

  await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)
  await expect(
    page.getByRole('heading', { name: /How can I help you,/ }),
  ).toBeVisible()
})
