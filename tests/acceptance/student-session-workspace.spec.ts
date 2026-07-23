import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from './support/demo-auth'

test.describe('Student session workspace', () => {
  test('persists a complete grounded turn across responsive widths', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInThroughUi(page, demoAccounts.student)

    await page.goto('/student/courses')
    await page.getByRole('link', { name: 'Open AI Tutor' }).first().click()

    await expect(page).toHaveURL(/\/student\/ai-tutor\?courseId=/)
    await expect(
      page.getByRole('button', { name: 'Open sessions' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Open sessions' }).click()

    const mobileDrawer = page.getByRole('dialog', { name: 'Course sessions' })
    await expect(mobileDrawer).toBeVisible()
    await expect(
      mobileDrawer.getByRole('complementary', {
        name: 'Session navigation',
      }),
    ).toBeVisible()
    await expect(
      mobileDrawer.getByRole('button', { name: 'New chat', exact: true }),
    ).toBeVisible()
    await mobileDrawer
      .getByRole('button', { name: 'New chat', exact: true })
      .click()

    await expect(mobileDrawer).toBeHidden()
    await expect(page).toHaveURL(/\/student\/ai-tutor\?courseId=.*&sessionId=/)
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()

    let releaseGeneration: (() => void) | undefined
    const generationGate = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })
    await page.route(
      '**/api/v1/courses/*/chat-sessions/*/messages',
      async (route) => {
        if (route.request().method() === 'POST') {
          await generationGate
        }
        await route.continue()
      },
    )

    const question = 'How do Python lists preserve insertion order?'
    const composer = page.getByRole('textbox', {
      name: 'Message',
      exact: true,
    })
    await composer.fill(question)
    await page.getByRole('button', { name: 'Send message' }).click()

    const conversationHistory = page.getByRole('list', {
      name: 'Conversation history',
    })
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toBeVisible()
    await expect(composer).toBeDisabled()
    await expect(
      page.getByRole('status').filter({
        hasText: 'Grounding your question in course materials',
      }),
    ).toBeVisible()

    if (!releaseGeneration) {
      throw new Error('Expected the grounded generation gate to be ready')
    }
    releaseGeneration()

    const guidanceLabel = page.getByText(
      /Course-grounded guidance|Course evidence not found/,
    )
    await expect(guidanceLabel).toBeVisible()

    if (await page.getByText('Course-grounded guidance').isVisible()) {
      const sources = page.getByRole('button', { name: /Sources \(\d+\)/ })
      await expect(sources).toBeVisible()
      await sources.click()
      await expect(
        page.getByRole('list', { name: 'Response sources' }),
      ).toBeVisible()
    } else {
      await expect(
        page.getByText('No supporting course sources were found.'),
      ).toBeVisible()
    }

    await page.reload()
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toHaveCount(1)
    await expect(guidanceLabel).toHaveCount(1)
    await expect(composer).toBeEnabled()
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
    await expect(
      page.getByRole('button', { name: 'New chat', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Message', exact: true }),
    ).toBeEnabled()
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toHaveCount(1)
    await expect(guidanceLabel).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })
})
