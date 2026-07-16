import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const apiBaseUrl = 'http://localhost:4000'
const clientBaseUrl = 'http://localhost:3000'
const demoPassword = 'MorshidDemoP0!'

const demoAccounts = {
  admin: { email: 'admin@morshid.demo' },
  instructor: { email: 'instructor@morshid.demo' },
  student: { email: 'student1@morshid.demo' },
  disabledStudent: { email: 'student3@morshid.demo' },
} as const

interface AuthSessionResponse {
  accessToken: string
}

interface ApiErrorResponse {
  code: string
  message: string
}

interface CourseListResponse {
  courses: {
    code: string
    membershipRole: 'INSTRUCTOR' | 'STUDENT' | null
  }[]
}

interface AdminManagedUsersResponse {
  users: {
    id: string
    email: string
    status: 'ACTIVE' | 'DISABLED'
  }[]
}

interface OpenApiDocument {
  openapi: string
  info: {
    description: string
    title: string
    version: string
  }
  paths: Record<string, unknown>
}

async function submitSignInForm(
  page: Page,
  account: (typeof demoAccounts)[keyof typeof demoAccounts],
) {
  await page.goto(`${clientBaseUrl}/login`)
  await page.getByLabel('Institutional Email').fill(account.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(demoPassword)
  await page.getByRole('button', { name: 'Sign In to Portal' }).click()
}

async function signInThroughUi(
  page: Page,
  account: (typeof demoAccounts)[keyof typeof demoAccounts],
) {
  await submitSignInForm(page, account)
  await expect(page).not.toHaveURL(/\/login\/?$/)
}

async function signInThroughApi(
  request: APIRequestContext,
  account: (typeof demoAccounts)[keyof typeof demoAccounts],
) {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/sign-in`, {
    data: {
      email: account.email,
      password: demoPassword,
    },
  })

  await expect(response).toBeOK()
  const session = (await response.json()) as AuthSessionResponse
  expect(session.accessToken).not.toBe('')
  return session.accessToken
}

function bearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

async function reactivateAdminUser(
  request: APIRequestContext,
  adminAccessToken: string,
  userId: string,
) {
  const response = await request.patch(
    `${apiBaseUrl}/api/v1/admin/users/${userId}/reactivate`,
    { headers: bearerHeaders(adminAccessToken) },
  )
  await expect(response).toBeOK()
}

test.describe('Sprint 1 acceptance and security', () => {
  test('seeded Admin signs in through the UI and reaches the Admin shell', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.admin)

    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(
      page.getByRole('navigation', { name: 'Admin navigation' }),
    ).toBeVisible()
  })

  test('seeded Instructor signs in through the UI and reaches the Instructor shell', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.instructor)

    await expect(page).toHaveURL(/\/instructor\/?$/)
    await expect(
      page.getByRole('heading', { name: 'Instructor dashboard' }),
    ).toBeVisible()
  })

  test('seeded Student signs in through the UI and reaches the Student shell', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student)

    await expect(page).toHaveURL(/\/student\/dashboard\/?$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

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
      await page.goto(`${clientBaseUrl}${forbiddenPath}`)

      await expect(page).toHaveURL(/\/student\/dashboard\/?$/)
      await expect(
        page.getByRole('heading', { name: 'Dashboard' }),
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

  test('Admin disables a seeded account, exposes the audit event, and blocks fresh sign-in', async ({
    browser,
    page,
    request,
  }) => {
    const adminAccessToken = await signInThroughApi(request, demoAccounts.admin)
    const usersResponse = await request.get(
      `${apiBaseUrl}/api/v1/admin/users?limit=50`,
      { headers: bearerHeaders(adminAccessToken) },
    )
    await expect(usersResponse).toBeOK()

    const usersBody = (await usersResponse.json()) as AdminManagedUsersResponse
    const disabledAccount = usersBody.users.find(
      (user) => user.email === demoAccounts.disabledStudent.email,
    )

    expect(disabledAccount).toBeDefined()
    if (!disabledAccount) {
      throw new Error('The seeded disabled-account fixture is missing')
    }

    if (disabledAccount.status === 'DISABLED') {
      await reactivateAdminUser(request, adminAccessToken, disabledAccount.id)
    }

    try {
      await signInThroughUi(page, demoAccounts.admin)
      await page.getByRole('link', { name: 'Users', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'User Management' }),
      ).toBeVisible()

      const accountRow = page
        .getByRole('row')
        .filter({ hasText: demoAccounts.disabledStudent.email })

      await expect(accountRow).toContainText('active')
      await accountRow.getByRole('button', { name: 'Disable user' }).click()

      const confirmDialog = page.getByRole('alertdialog', {
        name: 'Disable user',
      })
      await confirmDialog
        .getByRole('button', { name: 'Disable', exact: true })
        .click()
      await expect(accountRow).toContainText('disabled')

      await page.getByRole('link', { name: 'Audit Logs', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Recent Audit Activity' }),
      ).toBeVisible()
      await expect(
        page.getByText('admin.account_disabled', { exact: true }).first(),
      ).toBeVisible()

      const disabledContext = await browser.newContext()
      try {
        const disabledPage = await disabledContext.newPage()
        await submitSignInForm(disabledPage, demoAccounts.disabledStudent)

        await expect(disabledPage).toHaveURL(/\/login\/?$/)
        await expect(disabledPage.getByRole('alert')).toHaveText(
          'Your account is disabled. Please contact the administrator.',
        )
      } finally {
        await disabledContext.close()
      }
    } finally {
      await reactivateAdminUser(request, adminAccessToken, disabledAccount.id)
    }
  })

  test('Swagger UI and the Sprint 1 OpenAPI document are reachable', async ({
    page,
    request,
  }) => {
    await page.goto(`${apiBaseUrl}/docs`)
    await expect(
      page.getByRole('heading', { name: /Morshid API/ }),
    ).toBeVisible()

    const response = await request.get(`${apiBaseUrl}/docs-json`)
    await expect(response).toBeOK()

    const document = (await response.json()) as OpenApiDocument
    expect(document).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: {
        description: 'Foundation scaffold API for Morshid.',
        title: 'Morshid API',
        version: '0.1.0',
      },
    })
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/sign-in',
        '/api/v1/me',
        '/api/v1/courses',
        '/api/v1/admin/users',
        '/api/v1/admin/users/{userId}/disable',
        '/api/v1/admin/audit',
      ]),
    )
  })
})
