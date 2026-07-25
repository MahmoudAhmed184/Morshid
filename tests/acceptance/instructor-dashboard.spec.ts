import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from './support/demo-auth'

test.describe('Instructor workspace', () => {
  test('navigates every implemented destination and the legacy course route', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.instructor)

    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Python Programming' }),
    ).toBeVisible()

    const navigation = page.getByRole('list', {
      name: 'Instructor navigation',
    })
    await expect(navigation.getByRole('link')).toHaveText([
      'Dashboard',
      'Review Queue',
      'Materials',
      'Settings',
    ])

    const destinations = [
      {
        link: 'Review Queue',
        path: /\/instructor\/review-queue\/?$/,
        heading: 'Review Queue',
      },
      {
        link: 'Materials',
        path: /\/instructor\/materials\/?$/,
        heading: 'Course Materials',
      },
      {
        link: 'Settings',
        path: /\/instructor\/settings\/?$/,
        heading: 'Settings',
      },
    ] as const

    for (const destination of destinations) {
      await navigation
        .getByRole('link', { name: destination.link, exact: true })
        .click()
      await expect(page).toHaveURL(destination.path)
      await expect(
        page.getByRole('heading', {
          name: destination.heading,
          exact: true,
        }),
      ).toBeVisible()
    }

    await page.goto('/instructor/courses')
    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()

    await expect(
      page.getByRole('link', { name: /Students|Notifications|Analytics/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /Users|Audit Logs/ }),
    ).toHaveCount(0)
  })

  test('direct navigation to the Admin shell returns to the Instructor dashboard', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.instructor)

    await page.goto('/admin')

    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: "Today's teaching desk." }),
    ).toBeVisible()
  })

  test.describe('mobile navigation', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('uses the sidebar to move between workspace pages', async ({
      page,
    }) => {
      await signInThroughUi(page, demoAccounts.instructor)

      await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
      const sidebar = page.getByRole('dialog', { name: 'Sidebar' })
      await expect(sidebar).toBeVisible()

      await sidebar
        .getByRole('link', { name: 'Materials', exact: true })
        .click()
      await expect(page).toHaveURL(/\/instructor\/materials\/?$/)
      await expect(
        page.getByRole('heading', { name: 'Course Materials', exact: true }),
      ).toBeVisible()
      await expect(sidebar).toBeHidden()

      await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
      await sidebar.getByRole('link', { name: 'Settings', exact: true }).click()
      await expect(page).toHaveURL(/\/instructor\/settings\/?$/)
      await expect(
        page.getByRole('heading', { name: 'Settings', exact: true }),
      ).toBeVisible()
      await expect(sidebar).toBeHidden()
    })
  })
})
