import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from '../support/demo-auth'

test('seeded Instructor signs in through the UI and reaches the Instructor shell', async ({
  page,
}) => {
  await signInThroughUi(page, demoAccounts.instructor)

  await expect(page).toHaveURL(/\/instructor\/?$/)
  await expect(
    page.getByRole('heading', { name: "Today's teaching desk." }),
  ).toBeVisible()
})
