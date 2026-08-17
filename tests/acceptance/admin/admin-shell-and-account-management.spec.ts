import { expect, test } from '@playwright/test'

import {
  demoAccounts,
  submitSignInForm,
  signInThroughUi,
} from '../support/demo-auth'
import {
  apiBaseUrl,
  getAdminAuditEvents,
  reactivateAdminUser,
  signInThroughApi,
} from '../support/api'
import type { AdminManagedUsersResponse, OpenApiDocument } from '../support/api'

test.describe('Admin acceptance', () => {
  test('seeded Admin signs in through the UI and reaches the Admin shell', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.admin)

    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(
      page.getByRole('list', { name: 'Admin navigation' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'System overview.' }),
    ).toBeVisible()
  })

  test('Admin disables a seeded account, exposes the audit event, and blocks fresh sign-in', async ({
    browser,
    page,
    request,
  }) => {
    const adminAccessToken = await signInThroughApi(request, demoAccounts.admin)
    const usersResponse = await request.get(
      `${apiBaseUrl}/api/v1/admin/users?limit=50`,
      { headers: { Authorization: `Bearer ${adminAccessToken}` } },
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

    const auditBefore = await getAdminAuditEvents(request, adminAccessToken)
    const existingAuditIds = new Set(auditBefore.map((event) => event.id))

    try {
      await signInThroughUi(page, demoAccounts.admin)
      const adminNavigation = page.getByRole('list', {
        name: 'Admin navigation',
      })
      await adminNavigation
        .getByRole('link', { name: 'Students', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: 'Students', exact: true }),
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

      await adminNavigation
        .getByRole('link', { name: 'Audit Logs', exact: true })
        .click()
      await expect(
        page.getByRole('heading', { name: 'Recent Audit Activity' }),
      ).toBeVisible()

      const auditAfter = await getAdminAuditEvents(request, adminAccessToken)
      const disableAuditEvent = auditAfter.find(
        (event) =>
          !existingAuditIds.has(event.id) &&
          event.action === 'admin.account_disabled' &&
          event.targetId === disabledAccount.id,
      )

      expect(disableAuditEvent).toBeDefined()
      if (!disableAuditEvent) {
        throw new Error('The disable operation did not create an audit event')
      }

      const auditRow = page
        .getByRole('row')
        .filter({ hasText: disableAuditEvent.id })
      await expect(auditRow).toContainText('admin.account_disabled')
      await expect(auditRow).toContainText(disabledAccount.id)

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

  test('Swagger UI and the final OpenAPI document are reachable', async ({
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
        description: 'API for the Morshid Socratic teaching assistant.',
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
