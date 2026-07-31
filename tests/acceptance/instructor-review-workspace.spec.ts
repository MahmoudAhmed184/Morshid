import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { signInThroughUi } from './support/demo-auth'
import {
  createInstructorReviewAcceptanceFixture,
  type InstructorReviewAcceptanceFixture,
} from './support/review-fixture'

test.describe('Instructor review queue and bounded detail', () => {
  test.describe.configure({ mode: 'serial' })
  let fixture: InstructorReviewAcceptanceFixture

  test.beforeAll(async () => {
    fixture = await createInstructorReviewAcceptanceFixture()
  })

  test.afterAll(async () => {
    await fixture.dispose()
  })

  test('shows only assigned-course reviews with accessible queue metadata', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.instructorEmail })
    await page.goto('/instructor/review-queue')

    await expect(
      page.getByRole('heading', {
        name: 'Review Queue',
        exact: true,
        level: 1,
      }),
    ).toBeVisible()
    await expect(page.getByText('1 pending')).toBeVisible()

    const card = page
      .getByRole('article')
      .filter({ hasText: fixture.studentLabel })
    await expect(card).toBeVisible()
    await expect(card).toContainText(fixture.ownedCourseTitle)
    await expect(card).toContainText('Awaiting Review')
    await expect(card).toContainText('Student request')
    await expect(card).toContainText(/\d+m/)
    await expect(card.getByRole('link', { name: 'Review' })).toBeVisible()
    await expect(page.getByText(fixture.otherCourseTitle)).toHaveCount(0)

    const reviewLink = card.getByRole('link', { name: 'Review' })
    await reviewLink.focus()
    await expect(reviewLink).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(
      `/instructor/review-queue/${fixture.reviewCaseId}`,
    )
    const dialog = page.getByRole('dialog', {
      name: 'Instructor review detail',
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('heading', { name: 'Review flagged response' }),
    ).toBeVisible()

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL('/instructor/review-queue')
    await expect(
      page.getByRole('heading', {
        name: 'Review Queue',
        exact: true,
        level: 1,
      }),
    ).toBeVisible()

    await reviewLink.click()
    await expect(dialog).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/instructor/review-queue')
    await expect(dialog).toBeHidden()
  })

  test('renders bounded evidence and excludes unrelated or private data', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.instructorEmail })
    await page.goto(`/instructor/review-queue/${fixture.reviewCaseId}`)

    await expect(
      page.getByRole('heading', { name: 'Review detail' }),
    ).toBeVisible()
    await expect(page.getByText('Acceptance student note')).toBeVisible()
    await expect(page.getByText('Flagged acceptance question')).toBeVisible()
    await expect(
      page.getByText('Flagged acceptance assistant response'),
    ).toBeVisible()
    await expect(page.getByText('Previous bounded question')).toBeVisible()
    await expect(page.getByText('Previous bounded answer')).toBeVisible()
    await expect(page.getByText('Following bounded question')).toBeVisible()
    await expect(page.getByText('Following bounded answer')).toBeVisible()
    await expect(page.getByText(/Bounded citation snippet/)).toBeVisible()
    await expect(page.getByText('Bounded review source')).toBeVisible()

    for (const secret of Object.values(fixture.secrets)) {
      await expect(page.getByText(secret, { exact: false })).toHaveCount(0)
    }
    await expect(page.getByText('Other private question')).toHaveCount(0)
    await expect(page.getByText('Other private answer')).toHaveCount(0)
  })

  test('conceals unowned and guessed review ids identically', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.instructorEmail })

    const concealedMessages: string[] = []
    for (const reviewCaseId of [fixture.otherReviewCaseId, randomUUID()]) {
      const response = await page.goto(
        `/instructor/review-queue/${reviewCaseId}`,
      )
      expect(response?.status()).toBe(200)
      const concealedMessage = page.getByText(
        'This review is unavailable or you no longer have access.',
      )
      await expect(concealedMessage).toBeVisible()
      concealedMessages.push((await concealedMessage.textContent()) ?? '')
      await expect(page.getByText('Other private note')).toHaveCount(0)
      await expect(page.getByText('Other private question')).toHaveCount(0)
      await expect(page.getByText('Other private answer')).toHaveCount(0)
    }
    expect(new Set(concealedMessages)).toEqual(
      new Set(['This review is unavailable or you no longer have access.']),
    )
  })

  test('shows an empty queue for an Instructor with no assignments', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.emptyInstructorEmail })
    await page.goto('/instructor/review-queue')

    await expect(
      page.getByRole('heading', { name: 'No review requests' }),
    ).toBeVisible()
    await expect(page.getByText('0 pending')).toBeVisible()
  })

  test('keeps queue chrome accessible while the queue request loads', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.instructorEmail })
    let releaseRequest: () => void = () => undefined
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    await page.route('**/api/v1/instructor/reviews?*', async (route) => {
      await requestGate
      await route.continue()
    })

    const navigation = page.goto('/instructor/review-queue')
    await expect(
      page.getByRole('heading', {
        name: 'Review Queue',
        exact: true,
        level: 1,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', { name: 'Loading review queue' }),
    ).toBeVisible()
    releaseRequest()
    await navigation
    await expect(page.getByText(fixture.studentLabel)).toBeVisible()
  })

  test('conceals a review whose session was deleted', async ({ page }) => {
    await fixture.softDeleteOwnedSession()
    await signInThroughUi(page, { email: fixture.instructorEmail })
    await page.goto(`/instructor/review-queue/${fixture.reviewCaseId}`)

    await expect(
      page.getByRole('heading', { name: 'Unable to load review' }),
    ).toBeVisible()
    await expect(page.getByText('Flagged acceptance question')).toHaveCount(0)
  })
})
