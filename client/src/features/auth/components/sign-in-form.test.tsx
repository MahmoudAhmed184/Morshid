import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

import { SignInForm } from './sign-in-form'

const validEmail = 'instructor@morshid.demo'
const validPassword = 'password'
const navigateMock = vi.fn()
const mockSession = {
  tokenType: 'Bearer',
  user: {
    id: 'user-1',
    email: validEmail,
    displayName: 'P0 Demo Instructor',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    courses: [],
  },
  accessToken: 'server-access-token',
  accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  refreshToken: 'server-refresh-token',
  refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
} as const

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

function mockSignInResponse(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  )
}

function renderSignInForm() {
  render(<SignInForm />)
}

function getForm() {
  return screen
    .getByRole('button', { name: /sign in to portal/i })
    .closest('form')!
}

function getEmailInput() {
  return within(getForm()).getByPlaceholderText('instructor@morshid.demo')
}

function getPasswordInput() {
  return within(getForm()).getByPlaceholderText('••••••••')
}

function getSubmitButton() {
  return screen.getByRole('button', { name: /sign in to portal/i })
}

function fillSignInForm({
  email = validEmail,
  password = validPassword,
}: {
  email?: string
  password?: string
} = {}) {
  fireEvent.change(getEmailInput(), { target: { value: email } })
  fireEvent.change(getPasswordInput(), { target: { value: password } })
}

function submitSignInForm() {
  fireEvent.click(getSubmitButton())
}

async function waitForSignInRedirect() {
  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith({ to: '/instructor' })
  })
  await waitFor(() => {
    expect(getSubmitButton()).toHaveProperty('disabled', false)
  })
}

describe('SignInForm', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    navigateMock.mockReset()
    navigateMock.mockResolvedValue(undefined)
    mockSignInResponse(Response.json(mockSession))
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    navigateMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('email validation', () => {
    it('shows a required error for an empty email', async () => {
      renderSignInForm()
      submitSignInForm()

      expect(
        await screen.findByText('Institutional email is required'),
      ).toBeDefined()
    })

    it('shows an error for an invalid email format', async () => {
      renderSignInForm()
      fillSignInForm({ email: 'not-an-email', password: validPassword })
      submitSignInForm()

      expect(
        await screen.findByText('Enter a valid email address'),
      ).toBeDefined()
    })

    it('rejects emails with spaces inside', async () => {
      renderSignInForm()
      fillSignInForm({
        email: 'user name@morshid.demo',
        password: validPassword,
      })
      submitSignInForm()

      expect(
        await screen.findByText('Enter a valid email address'),
      ).toBeDefined()
    })

    it('rejects emails longer than 254 characters', async () => {
      renderSignInForm()
      fillSignInForm({
        email: `${'a'.repeat(243)}@morshid.demo`,
        password: validPassword,
      })
      submitSignInForm()

      expect(
        await screen.findByText('Email must be at most 254 characters'),
      ).toBeDefined()
    })

    it('accepts valid email with leading and trailing spaces after trim', async () => {
      renderSignInForm()
      fillSignInForm({
        email: '  Instructor@Morshid.demo  ',
        password: validPassword,
      })
      submitSignInForm()

      await waitForSignInRedirect()
    })
  })

  describe('password validation', () => {
    it('shows a required error for an empty password', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: '' })
      submitSignInForm()

      expect(await screen.findByText('Password is required')).toBeDefined()
    })

    it('does not apply account-creation rules during sign in', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'short' })
      submitSignInForm()

      await waitForSignInRedirect()
    })

    it('accepts valid server credentials', async () => {
      renderSignInForm()
      fillSignInForm()
      submitSignInForm()

      await waitForSignInRedirect()
    })
  })

  describe('UX behavior', () => {
    it('shows errors under the correct fields', async () => {
      renderSignInForm()
      submitSignInForm()

      const emailError = await screen.findByText(
        'Institutional email is required',
      )
      const passwordError = await screen.findByText('Password is required')

      expect(emailError.compareDocumentPosition(getEmailInput())).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      )
      expect(passwordError.compareDocumentPosition(getPasswordInput())).toBe(
        Node.DOCUMENT_POSITION_PRECEDING,
      )
    })

    it('clears field errors when the user fixes the value', async () => {
      renderSignInForm()
      submitSignInForm()

      expect(
        await screen.findByText('Institutional email is required'),
      ).toBeDefined()

      fireEvent.change(getEmailInput(), { target: { value: validEmail } })

      await waitFor(() => {
        expect(screen.queryByText('Institutional email is required')).toBeNull()
      })
    })

    it('toggles password visibility', () => {
      renderSignInForm()

      const passwordInput = getPasswordInput()
      const toggleButton = within(getForm()).getByRole('button', {
        name: /show password/i,
      })

      expect(passwordInput).toHaveAttribute('type', 'password')

      fireEvent.click(toggleButton)
      expect(passwordInput).toHaveAttribute('type', 'text')

      fireEvent.click(
        within(getForm()).getByRole('button', {
          name: /hide password/i,
        }),
      )

      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('disables the submit button while submitting', async () => {
      let resolveRequest: ((response: Response) => void) | undefined

      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              resolveRequest = resolve
            }),
        ),
      )
      renderSignInForm()
      fillSignInForm()
      submitSignInForm()

      await waitFor(() => {
        expect(getSubmitButton()).toHaveProperty('disabled', true)
      })
      resolveRequest?.(Response.json(mockSession))
      await waitForSignInRedirect()
    })

    it('submits when Enter is pressed', async () => {
      renderSignInForm()
      fillSignInForm()

      fireEvent.submit(getForm())

      await waitForSignInRedirect()
    })

    it('keeps the session in memory and redirects on valid seeded credentials', async () => {
      renderSignInForm()
      fillSignInForm({
        email: 'INSTRUCTOR@MORSHID.DEMO',
        password: validPassword,
      })
      submitSignInForm()

      await waitForSignInRedirect()
      expect(useAuthStore.getState()).toMatchObject({
        user: {
          email: validEmail,
          displayName: 'P0 Demo Instructor',
          role: 'INSTRUCTOR',
          status: 'ACTIVE',
          courses: [],
        },
        tokenType: 'Bearer',
        accessToken: 'server-access-token',
        accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
        refreshToken: 'server-refresh-token',
        refreshTokenExpiresAt: '2026-07-18T12:00:00.000Z',
        isAuthenticated: true,
      })
      expect(navigateMock).toHaveBeenCalledWith({ to: '/instructor' })
      expect(window.sessionStorage.getItem('morshid.auth.session')).toBeNull()
      expect(window.localStorage.getItem('morshid.auth.session')).toBeNull()
    })

    it('shows a generic error for wrong credentials', async () => {
      mockSignInResponse(
        Response.json(
          {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          {
            status: 401,
          },
        ),
      )
      renderSignInForm()
      fillSignInForm({ password: 'Password1!' })
      submitSignInForm()

      expect(await screen.findByText(INVALID_CREDENTIALS_MESSAGE)).toBeDefined()
      expect(navigateMock).not.toHaveBeenCalled()
    })

    it('shows the disabled account message for disabled credentials', async () => {
      mockSignInResponse(
        Response.json(
          {
            code: 'ACCOUNT_DISABLED',
            message: 'Account is disabled',
          },
          {
            status: 403,
          },
        ),
      )
      renderSignInForm()
      fillSignInForm({
        email: 'disabled@morshid.demo',
        password: validPassword,
      })
      submitSignInForm()

      expect(await screen.findByText(DISABLED_ACCOUNT_MESSAGE)).toBeDefined()
    })

    it('does not submit when the form is invalid', async () => {
      renderSignInForm()
      fillSignInForm({ email: 'invalid-email', password: 'short' })
      submitSignInForm()

      await screen.findByText('Enter a valid email address')

      expect(navigateMock).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('marks invalid fields with aria-invalid and connects error messages', async () => {
      renderSignInForm()
      submitSignInForm()

      const emailError = await screen.findByText(
        'Institutional email is required',
      )
      const emailInput = getEmailInput()

      expect(emailInput.getAttribute('aria-invalid')).toBe('true')
      expect(emailInput.getAttribute('aria-describedby')).toBe(emailError.id)
    })
  })
})
