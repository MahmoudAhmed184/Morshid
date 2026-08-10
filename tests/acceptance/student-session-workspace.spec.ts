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
    await expect(guidanceLabel).toBeVisible({ timeout: 30_000 })

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

  test('renders the progressive Level 1–4 Socratic journey in the browser', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student)
    await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)

    const studentPrompts = [
      'Please solve my loop exercise for me.',
      'I tried updating the state before checking the condition.',
      'I moved the check first and traced one row.',
      'I am still stuck on the remaining iterations.',
    ]
    const tutorResponses = [
      'What have you tried so far? Here is one small starting hint: record the initial state.',
      'The likely misconception is the order of the check and update. Which appears first in the loop syntax?',
      'You correctly placed the check first. What state belongs in the next reasoning row?',
      'Use an analogous loop with a different starting state to build a two-column trace, then apply that pattern to your original exercise.',
    ]
    const ids = [
      [
        '20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
      ],
      [
        '20000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000004',
      ],
      [
        '20000000-0000-4000-8000-000000000005',
        '20000000-0000-4000-8000-000000000006',
      ],
      [
        '20000000-0000-4000-8000-000000000007',
        '20000000-0000-4000-8000-000000000008',
      ],
    ] as const
    const history: Record<string, unknown>[] = []
    let turnIndex = 0

    await page.route(
      '**/api/v1/courses/*/chat-sessions/*/messages*',
      async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            contentType: 'application/json',
            json: { messages: history, nextCursor: null },
            status: 200,
          })
          return
        }
        if (route.request().method() !== 'POST') {
          await route.continue()
          return
        }

        const index = turnIndex
        turnIndex += 1
        const now = new Date(2026, 7, 10, 5, index).toISOString()
        const studentMessage = {
          id: ids[index][0],
          sequence: index * 2 + 1,
          role: 'STUDENT',
          turnId: null,
          topicId: null,
          responseToMessageId: null,
          content: studentPrompts[index],
          status: 'COMPLETED',
          requestKind: index === 0 ? 'PROBLEM_LIKE' : 'ATTEMPT_DIAGNOSIS',
          guidanceLabel: null,
          hintLevel: null,
          promptVersion: null,
          errorCode: null,
          createdAt: now,
          completedAt: now,
          citations: [],
        }
        const assistantMessage = {
          id: ids[index][1],
          sequence: index * 2 + 2,
          role: 'ASSISTANT',
          turnId: null,
          topicId: null,
          responseToMessageId: studentMessage.id,
          content: tutorResponses[index],
          status: 'COMPLETED',
          requestKind: null,
          guidanceLabel: 'COURSE_GROUNDED',
          hintLevel: index + 1,
          promptVersion: 'tutor-generation.mvp.v3',
          errorCode: null,
          createdAt: now,
          completedAt: now,
          citations: [],
        }
        history.push(studentMessage, assistantMessage)
        await route.fulfill({
          contentType: 'application/json',
          json: { studentMessage, assistantMessage },
          status: 201,
        })
      },
    )

    const composer = page.getByRole('textbox', { name: 'Message', exact: true })
    for (let index = 0; index < studentPrompts.length; index += 1) {
      await composer.fill(studentPrompts[index])
      await page.getByRole('button', { name: 'Send message' }).click()
      await expect(
        page.getByText(tutorResponses[index], { exact: true }),
      ).toBeVisible()
    }

    const conversation = page.getByRole('list', {
      name: 'Conversation history',
    })
    for (const response of tutorResponses) {
      await expect(
        conversation.getByText(response, { exact: true }),
      ).toHaveCount(1)
    }
    await expect(
      conversation.getByText(
        /exact final output is|complete solution|corrected code/iu,
      ),
    ).toHaveCount(0)
  })

  test('keeps mobile settings clear of fixed controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signInThroughUi(page, demoAccounts.student)

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
