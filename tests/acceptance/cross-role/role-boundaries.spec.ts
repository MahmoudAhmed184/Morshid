import { expect, test } from '@playwright/test'

import { demoAccounts, signInThroughUi } from '../support/demo-auth'
import { apiBaseUrl, bearerHeaders, signInThroughApi } from '../support/api'
import type { ApiErrorResponse, CourseListResponse } from '../support/api'

test.describe('Cross-role acceptance and security', () => {
  test('Student direct navigation to Admin and Instructor routes returns to the Student shell', async ({
    page,
  }) => {
    const hydrationErrors: string[] = []
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        message
          .text()
          .includes(
            "Hydration failed because the server rendered HTML didn't match the client",
          )
      ) {
        hydrationErrors.push(message.text())
      }
    })

    await signInThroughUi(page, demoAccounts.student)

    for (const forbiddenPath of ['/admin', '/instructor']) {
      await page.goto(forbiddenPath)

      await expect(page).toHaveURL(/\/chat(?:\?.*)?$/)
      await expect(
        page.getByRole('heading', { name: /How can I help you,/ }),
      ).toBeVisible()
    }

    expect(hydrationErrors).toEqual([])
  })

  test('Student bearer token is denied by Admin read and mutation endpoints', async ({
    request,
  }) => {
    const accessToken = await signInThroughApi(request, demoAccounts.student)
    const adminRequests = [
      request.get(`${apiBaseUrl}/api/v1/admin/users`, {
        headers: bearerHeaders(accessToken),
      }),
      request.patch(
        `${apiBaseUrl}/api/v1/admin/users/00000000-0000-4000-8000-000000000000/disable`,
        { headers: bearerHeaders(accessToken) },
      ),
    ]

    for (const responsePromise of adminRequests) {
      const response = await responsePromise
      const body = (await response.json()) as ApiErrorResponse

      expect(response.status()).toBe(403)
      expect(body).toEqual({
        code: 'INSUFFICIENT_ROLE',
        message: 'Insufficient role',
      })
    }
  })

  test('course lists expose only the courses and membership roles allowed for each seeded role', async ({
    request,
  }) => {
    const scenarios = [
      {
        account: demoAccounts.admin,
        expectedCourses: [
          { code: 'HIDDEN-ISOLATION', membershipRole: null },
          { code: 'PYTHON-PROG-P0', membershipRole: null },
        ],
        role: 'Admin',
      },
      {
        account: demoAccounts.instructor,
        expectedCourses: [
          { code: 'PYTHON-PROG-P0', membershipRole: 'INSTRUCTOR' },
        ],
        role: 'Instructor',
      },
      {
        account: demoAccounts.student,
        expectedCourses: [
          { code: 'PYTHON-PROG-P0', membershipRole: 'STUDENT' },
        ],
        role: 'Student',
      },
    ] as const

    for (const scenario of scenarios) {
      await test.step(scenario.role, async () => {
        const accessToken = await signInThroughApi(request, scenario.account)
        const response = await request.get(`${apiBaseUrl}/api/v1/courses`, {
          headers: bearerHeaders(accessToken),
        })

        await expect(response).toBeOK()
        const body = (await response.json()) as CourseListResponse
        const courses = body.courses.map(({ code, membershipRole }) => ({
          code,
          membershipRole,
        }))

        expect(courses).toEqual(scenario.expectedCourses)

        if (scenario.role !== 'Admin') {
          expect(courses).not.toContainEqual(
            expect.objectContaining({ code: 'HIDDEN-ISOLATION' }),
          )
        }
      })
    }
  })
})
