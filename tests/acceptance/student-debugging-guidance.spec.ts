import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import {
  demoAccounts,
  demoPassword,
  signInThroughUi,
} from './support/demo-auth'

const apiBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? '4000'}`
const sourceTitle =
  'p0-npt-part-02 Functions and Scope [deterministic-embedding-v1]'
const sourceFixturePath = resolve(
  process.cwd(),
  'fixtures',
  'sources',
  'Python_Part_2.pdf',
)

interface AuthSessionResponse {
  accessToken: string
}

interface CourseListResponse {
  courses: { id: string; code: string }[]
}

interface MaterialResponse {
  material: { id: string; status: MaterialStatus; title: string }
}

interface MaterialListResponse {
  materials: { id: string; status: MaterialStatus; title: string }[]
}

interface MaterialStatusResponse {
  status: MaterialStatus
}

type MaterialStatus = 'PROCESSING' | 'READY' | 'WARNING' | 'FAILED'

test.describe('Student debugging guidance', () => {
  test('persists readable gd-p0-v1-058 code, diagnosis, label, and citations across reload', async ({
    page,
    request,
  }) => {
    await ensureFunctionsAndScopeSource(request)
    await signInThroughUi(page, demoAccounts.student2)

    const question = [
      'Why does this Python function crash?',
      '```python',
      'def average(nums):',
      '    total = 0',
      '    for i in range(len(nums)):',
      '        total += nums[i]',
      '    return total / len(num)',
      '```',
    ].join('\n')
    const composer = page.getByRole('textbox', { name: 'Message', exact: true })
    await composer.fill(question)
    await page.getByRole('button', { name: 'Send message' }).click()

    const history = page.getByRole('list', { name: 'Conversation history' })
    const code = history.getByLabel('python code')
    await expect(code).toBeVisible()
    await expect(code).toHaveText(
      [
        'def average(nums):',
        '    total = 0',
        '    for i in range(len(nums)):',
        '        total += nums[i]',
        '    return total / len(num)',
      ].join('\n'),
    )
    await expect(history.getByText('STATIC PYTHON DIAGNOSIS')).toBeVisible()
    await expect(history.getByText('GROUNDED IN COURSE SOURCES')).toBeVisible()
    await expect(history.getByText(/^Likely defect\b/iu)).toBeVisible()
    await expect(history.getByText(/num.*nums/iu)).toBeVisible()
    await expect(history.getByText(/name lookup.*scope/iu)).toBeVisible()
    await expect(history.getByText('Next inspection step')).toHaveCount(1)
    await expect(history.getByLabel('Inline citations')).toContainText(
      sourceTitle,
    )

    const diagnosisBeforeReload = await history
      .getByText('Likely defect')
      .locator('..')
      .textContent()
    await page.reload()

    await expect(history.getByLabel('python code')).toHaveText(
      [
        'def average(nums):',
        '    total = 0',
        '    for i in range(len(nums)):',
        '        total += nums[i]',
        '    return total / len(num)',
      ].join('\n'),
    )
    await expect(history.getByText('STATIC PYTHON DIAGNOSIS')).toBeVisible()
    await expect(history.getByLabel('Inline citations')).toContainText(
      sourceTitle,
    )
    expect(
      await history.getByText('Likely defect').locator('..').textContent(),
    ).toBe(diagnosisBeforeReload)
  })

  test('shows an unsupported-language boundary for clearly unsupported code', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student2)

    const jsCode = [
      '```javascript',
      'function countItems(nums) {',
      '  return nums.length;',
      '}',
      '```',
    ].join('\n')
    const composer = page.getByRole('textbox', { name: 'Message', exact: true })
    await composer.fill(jsCode)
    await page.getByRole('button', { name: 'Send message' }).click()

    const history = page.getByRole('list', { name: 'Conversation history' })
    await expect(history.getByText(/supported code snippet/iu)).toBeVisible()
    await expect(history.getByText('Likely defect')).not.toBeVisible()
  })

  test('shows reduction request for over-limit code', async ({
    page,
  }) => {
    await signInThroughUi(page, demoAccounts.student2)

    const longPython = [
      'if True:',
      ...Array.from({ length: 100 }, () => '    pass'),
    ].join('\n')
    const composer = page.getByRole('textbox', { name: 'Message', exact: true })
    await composer.fill(longPython)
    await page.getByRole('button', { name: 'Send message' }).click()

    const history = page.getByRole('list', { name: 'Conversation history' })
    await expect(history.getByText(/101 normalized lines/iu)).toBeVisible()
    await expect(history.getByText(/at most 100/iu)).toBeVisible()
    await expect(history.getByText('Likely defect')).not.toBeVisible()
  })

  test('refuses a full-rewrite request while preserving a diagnosis hint', async ({
    page,
    request,
  }) => {
    await ensureFunctionsAndScopeSource(request)
    await signInThroughUi(page, demoAccounts.student2)

    const rewriteRequest = [
      'Rewrite the whole assignment and give me the complete corrected solution.',
      '```python',
      'def average(nums):',
      '    return sum(nums) / len(num)',
      '```',
    ].join('\n')
    const composer = page.getByRole('textbox', { name: 'Message', exact: true })
    await composer.fill(rewriteRequest)
    await page.getByRole('button', { name: 'Send message' }).click()

    const history = page.getByRole('list', { name: 'Conversation history' })
    await expect(
      history.getByText(/cannot provide a complete corrected program/iu),
    ).toBeVisible()
    await expect(history.getByText(/^Likely defect\b/iu)).toBeVisible()
    await expect(history.getByText('Next inspection step')).toBeVisible()
  })
})

async function ensureFunctionsAndScopeSource(request: APIRequestContext) {
  const token = await signInThroughApi(request)
  const headers = { Authorization: `Bearer ${token}` }
  const coursesResponse = await request.get(`${apiBaseUrl}/api/v1/courses`, {
    headers,
  })
  await expect(coursesResponse).toBeOK()
  const courses = (await coursesResponse.json()) as CourseListResponse
  const pythonCourse = courses.courses.find(
    ({ code }) => code === 'PYTHON-PROG-P0',
  )
  if (pythonCourse === undefined) {
    throw new Error('The seeded Python course is missing')
  }

  const materialsResponse = await request.get(
    `${apiBaseUrl}/api/v1/courses/${pythonCourse.id}/materials`,
    { headers },
  )
  await expect(materialsResponse).toBeOK()
  const materials = (await materialsResponse.json()) as MaterialListResponse
  let material = materials.materials.find(
    (candidate) =>
      candidate.title === sourceTitle && candidate.status !== 'FAILED',
  )

  if (material === undefined) {
    const uploadResponse = await request.post(
      `${apiBaseUrl}/api/v1/courses/${pythonCourse.id}/materials`,
      {
        headers,
        multipart: {
          title: sourceTitle,
          file: {
            name: 'Python_Part_2.pdf',
            mimeType: 'application/pdf',
            buffer: await readFile(sourceFixturePath),
          },
        },
      },
    )
    await expect(uploadResponse).toBeOK()
    material = ((await uploadResponse.json()) as MaterialResponse).material
  }

  const selectedMaterial = material
  if (
    selectedMaterial.status === 'READY' ||
    selectedMaterial.status === 'WARNING'
  ) {
    return
  }

  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${apiBaseUrl}/api/v1/courses/${pythonCourse.id}/materials/${selectedMaterial.id}/status`,
          { headers },
        )
        if (!response.ok()) {
          return `HTTP_${response.status().toString()}`
        }
        return ((await response.json()) as MaterialStatusResponse).status
      },
      {
        message: 'The functions-and-scope source should finish processing',
        timeout: 60_000,
      },
    )
    .toMatch(/READY|WARNING/u)
}

async function signInThroughApi(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/v1/auth/sign-in`, {
    data: {
      email: demoAccounts.instructor.email,
      password: demoPassword,
    },
  })
  await expect(response).toBeOK()
  return ((await response.json()) as AuthSessionResponse).accessToken
}
