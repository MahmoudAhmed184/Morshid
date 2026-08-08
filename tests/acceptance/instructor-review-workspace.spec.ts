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
    await expect(card).toContainText('Seems incorrect')
    await expect(card).toContainText('Acceptance student note')
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

  test('filters categorized Student requests while preserving queue controls', async ({
    page,
  }) => {
    await signInThroughUi(page, { email: fixture.instructorEmail })
    await page.goto('/instructor/review-queue')

    const incorrect = page.getByRole('button', { name: 'Seems incorrect' })
    await incorrect.click()
    await expect(incorrect).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(fixture.studentLabel)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'All courses' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'All triggers' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Confusing or unclear' }).click()
    await expect(
      page.getByRole('heading', { name: 'No matching reviews' }),
    ).toBeVisible()
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
    await expect(page.getByText('Seems incorrect')).toBeVisible()
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

  test('resolves the review and exposes one unread Student notification', async ({
    browser,
  }) => {
    const instructorContext = await browser.newContext()
    const instructorPage = await instructorContext.newPage()
    await signInThroughUi(instructorPage, { email: fixture.instructorEmail })
    await instructorPage.goto(
      `/instructor/review-queue/${fixture.reviewCaseId}`,
    )
    await instructorPage
      .getByRole('button', { name: 'Approve original guidance' })
      .click()
    const confirmation = instructorPage.getByRole('alertdialog', {
      name: 'Publish this terminal review outcome?',
    })
    await expect(confirmation).toContainText(
      'Flagged acceptance assistant response',
    )
    await confirmation.getByRole('button', { name: 'Publish outcome' }).click()
    await expect(
      instructorPage.getByText('Resolved', { exact: true }),
    ).toBeVisible()
    await expect(
      instructorPage.getByText('Flagged acceptance assistant response'),
    ).toBeVisible()
    await instructorContext.close()

    const studentContext = await browser.newContext()
    const studentPage = await studentContext.newPage()
    await signInThroughUi(studentPage, { email: fixture.secrets.studentEmail })
    const notifications = studentPage.getByRole('button', {
      name: 'Notifications, 1 unread',
    })
    await expect(notifications).toBeVisible()
    await notifications.click()
    const completed = studentPage.getByText('Instructor review completed')
    await expect(completed).toBeVisible()
    await completed.click()
    await expect(
      studentPage.getByRole('button', { name: 'Notifications', exact: true }),
    ).toBeVisible()
    await studentContext.close()
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
      page.getByText(
        'New flagged responses from your assigned courses will appear here.',
      ),
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
    await page.getByRole('tab', { name: /Resolved/ }).click()
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
