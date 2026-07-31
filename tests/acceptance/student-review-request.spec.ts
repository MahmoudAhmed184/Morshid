import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

import {
  demoAccounts,
  demoPassword,
  signInThroughUi,
} from './support/demo-auth'
import { createReviewBrowserFixture } from './support/review-fixture'

const apiBaseUrl = 'http://localhost:4000'

test('Student review remains pending across refresh and reopen, deduplicates, enforces quota, and stays accessible', async ({
  page,
  request,
}) => {
  const fixture = await createReviewBrowserFixture(
    demoAccounts.reviewStudent.email,
  )
  const chatUrl = `/chat?courseId=${fixture.courseId}&sessionId=${fixture.sessionId}`

  try {
    await signInThroughUi(page, demoAccounts.reviewStudent)
    await page.goto(chatUrl)
    await expect(page.getByText('Eligible review response 1')).toBeVisible({
      timeout: 15_000,
    })
    const actionButtons = page.getByRole('button', { name: 'Request review' })
    await expect(actionButtons).toHaveCount(4, { timeout: 15_000 })

    await actionButtons.first().focus()
    await expect(actionButtons.first()).toBeFocused()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', {
      name: 'Request Instructor review',
    })
    await expect(dialog).toBeVisible()
    const note = dialog.getByRole('textbox', { name: 'Note (optional)' })
    await expect(note).toBeFocused()
    await expect(note).toHaveAttribute('aria-describedby', /review-note-count/)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(dialog).toContainText('Submit request')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await openReviewDialog(actionButtons.first())
    await note.fill('Please verify the explanation')
    const firstResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/messages/${fixture.messageIds[0]}/review-requests`) &&
        response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: 'Submit request' }).click()
    const firstResponse = await firstResponsePromise
    expect(firstResponse.status()).toBe(201)
    const created = (await firstResponse.json()) as { caseId: string }
    const pending = page
      .locator('[data-slot="badge"]', { hasText: 'Pending review' })
      .first()
    await expect(pending).toBeVisible()
    await expect(actionButtons).toHaveCount(3)

    await page.reload()
    await expect(pending).toBeVisible()
    await expect(actionButtons).toHaveCount(3)
    await page.goto('/settings')
    await page.goto(chatUrl)
    await expect(pending).toBeVisible()

    const auth = await request.post(`${apiBaseUrl}/api/v1/auth/sign-in`, {
      data: {
        email: demoAccounts.reviewStudent.email,
        password: demoPassword,
      },
    })
    const { accessToken } = (await auth.json()) as { accessToken: string }
    const duplicate = await request.post(
      `${apiBaseUrl}/api/v1/messages/${fixture.messageIds[0]}/review-requests`,
      {
        data: { note: 'Please verify the explanation' },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Idempotency-Key': `browser-duplicate-${crypto.randomUUID()}`,
        },
      },
    )
    expect(duplicate.status()).toBe(200)
    expect(((await duplicate.json()) as { caseId: string }).caseId).toBe(
      created.caseId,
    )
    expect(await fixture.countCases()).toBe(1)

    for (const responseText of [
      'Eligible review response 2',
      'Eligible review response 3',
    ]) {
      const message = page.getByText(responseText).locator('..').locator('..')
      await openReviewDialog(
        message.getByRole('button', { name: 'Request review' }),
      )
      await page.getByRole('button', { name: 'Submit request' }).click()
      await expect(
        message.locator('[data-slot="badge"]', {
          hasText: 'Pending review',
        }),
      ).toBeVisible()
    }

    const fourthMessage = page
      .getByText('Eligible review response 4')
      .locator('..')
      .locator('..')
    const fourthActions = fourthMessage.getByRole('button', {
      name: 'Request review',
    })
    await openReviewDialog(fourthActions)
    const submit = page.getByRole('button', { name: 'Submit request' })
    await submit.click()
    const quotaError = page.getByRole('alert')
    await expect(quotaError).toContainText(
      'You have reached today’s review request limit.',
    )
    await expect(submit).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(fourthActions).toBeVisible()
    expect(await fixture.countCases()).toBe(3)
  } finally {
    await fixture.dispose()
  }
})

async function openReviewDialog(actionButton: Locator) {
  await actionButton.click()
}
