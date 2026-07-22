import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from './support/demo-auth'

test.describe('Instructor dashboard', () => {
  test('Instructor navigates every implemented workspace destination', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.instructor)

    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Python Programming' }),
    ).toBeVisible()

    const navigation = page.getByRole('navigation', {
      name: 'Instructor navigation',
    })

    await expect(navigation.getByRole('link')).toHaveText([
      'Dashboard',
      'My Courses',
      'Review Queue',
      'Materials',
    ])

    const destinations = [
      {
        link: 'My Courses',
        path: /\/instructor\/courses\/?$/,
        heading: 'My Courses',
      },
      {
        link: 'Review Queue',
        path: /\/instructor\/review-queue\/?$/,
        heading: 'Review Queue',
        placeholder: 'No review requests yet',
      },
      {
        link: 'Materials',
        path: /\/instructor\/materials\/?$/,
        heading: 'Course Materials',
        placeholder: 'No materials yet',
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

      if ('placeholder' in destination) {
        await expect(page.getByText(destination.placeholder)).toBeVisible()
      }
    }

    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await expect(page).toHaveURL(/\/instructor\/settings\/?$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await expect(
      page.getByRole('link', { name: /Students|Notifications|Analytics/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /Users|Audit Logs/ }),
    ).toHaveCount(0)
  })

  test('Instructor direct navigation to the Admin shell returns to the Instructor dashboard', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.instructor)

    await page.goto('/admin')

    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
  })

  test.describe('mobile navigation', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('Instructor uses the menu to move between workspace pages', async ({
      page,
    }) => {
      await signInThroughUi(page, demoAccounts.instructor)

      await page.getByRole('button', { name: 'Open menu' }).click()
      const menu = page.getByRole('dialog', { name: 'Menu' })
      await expect(menu).toBeVisible()

      await menu.getByRole('link', { name: 'Materials', exact: true }).click()
      await expect(page).toHaveURL(/\/instructor\/materials\/?$/)
      await expect(
        page.getByRole('heading', { name: 'Course Materials', exact: true }),
      ).toBeVisible()
      await expect(menu).toBeHidden()

      await page.getByRole('button', { name: 'Open menu' }).click()
      await menu.getByRole('link', { name: 'Settings', exact: true }).click()
      await expect(page).toHaveURL(/\/instructor\/settings\/?$/)
      await expect(
        page.getByRole('heading', { name: 'Settings', exact: true }),
      ).toBeVisible()
      await expect(menu).toBeHidden()
    })
  })
})
