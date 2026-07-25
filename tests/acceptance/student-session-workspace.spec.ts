import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from './support/demo-auth'

test.describe('Student session workspace', () => {
  test('creates a grounded conversation lazily and preserves it responsively', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInThroughUi(page, demoAccounts.student)

    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)
    await expect(
      page.getByRole('heading', { name: /How can I help you,/ }),
    ).toBeVisible()

    const composer = page.getByRole('textbox', {
      name: 'Message',
      exact: true,
    })
    await expect(composer).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    const sidebar = page.getByRole('dialog', { name: 'Sidebar' })
    await expect(sidebar).toBeVisible()
    const courseSwitcher = sidebar.getByRole('button', {
      name: /Current course:.*Choose course/,
    })
    await expect(courseSwitcher).toBeVisible()
    await expect(
      sidebar.getByRole('button', { name: 'New chat', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    await expect(sidebar).toBeHidden()

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
    await composer.fill(question)
    await page.getByRole('button', { name: 'Send message' }).click()

    // A draft has no session id. The first send creates one and then performs
    // the normal optimistic message flow in the routed conversation. The two
    // search params are asserted independently of their serialized order.
    await expect(page).toHaveURL(/\/chat\?(?=.*\bcourseId=)(?=.*\bsessionId=)/)
    const conversationHistory = page.getByRole('list', {
      name: 'Conversation history',
    })
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('status', {
        name: 'Grounding your question in course materials',
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
      await sources.click()
      await expect(
        page.getByRole('list', { name: 'Response sources' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Show sources and citations' }),
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
      page.getByRole('button', { name: 'New chat', exact: true }),
    ).toBeVisible()
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toHaveCount(1)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)

    // The notebook switcher is the only course-selection surface left. Choosing
    // a notebook re-scopes the workspace to that course and drops the routed
    // session, returning to the draft state.
    await page
      .getByRole('button', { name: /Current course:.*Choose course/ })
      .click()
    const notebooks = page.getByRole('menu')
    await expect(
      notebooks.getByRole('menuitem', { name: 'Python Programming' }),
    ).toBeVisible()
    await notebooks
      .getByRole('menuitem', { name: 'Python Programming' })
      .click()

    await expect(page).toHaveURL(/\/chat\?courseId=[^&]+$/)
    await expect(
      page.getByRole('heading', { name: /How can I help you,/ }),
    ).toBeVisible()
    await expect(
      conversationHistory.getByText(question, { exact: true }),
    ).toHaveCount(0)
  })

  test('keeps compatibility routes and mobile settings clear of fixed controls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInThroughUi(page, demoAccounts.student)

    await page.goto('/student/ai-tutor')
    await expect(page).toHaveURL('/chat')

    await page.goto('/student/courses')
    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)

    await page.goto('/settings')
    const heading = page.getByRole('heading', { name: 'Settings' })
    await expect(heading).toBeVisible()
    await expect
      .poll(async () => (await heading.boundingBox())?.y ?? 0)
      .toBeGreaterThanOrEqual(64)
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true)
  })
})
