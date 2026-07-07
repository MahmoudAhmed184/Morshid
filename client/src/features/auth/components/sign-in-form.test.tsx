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

const successMessage = 'Signed in successfully.'
const validEmail = 'instructor@morshid.demo'
const validPassword = 'password'

function renderSignInForm(props?: { onSubmitDelay?: number }) {
  render(<SignInForm {...props} />)
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

describe('SignInForm', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
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
        await screen.findByText('Email cannot contain spaces'),
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

      await waitFor(() => {
        expect(screen.getByText(successMessage)).toBeDefined()
      })
    })
  })

  describe('password validation', () => {
    it('shows a required error for an empty password', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: '' })
      submitSignInForm()

      expect(await screen.findByText('Security key is required')).toBeDefined()
    })

    it('rejects passwords shorter than 8 characters', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'Pass1!' })
      submitSignInForm()

      expect(
        await screen.findByText('Password must be at least 8 characters'),
      ).toBeDefined()
    })

    it('rejects passwords longer than 128 characters', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'p'.repeat(129) })
      submitSignInForm()

      expect(
        await screen.findByText('Password must be at most 128 characters'),
      ).toBeDefined()
    })

    it('rejects passwords with leading or trailing spaces', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: ' password ' })
      submitSignInForm()

      expect(
        await screen.findByText('Password cannot start or end with spaces'),
      ).toBeDefined()
    })

    it('rejects passwords without an uppercase letter', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'password1!' })
      submitSignInForm()

      expect(
        await screen.findByText('Password must include an uppercase letter'),
      ).toBeDefined()
    })

    it('rejects passwords without a lowercase letter', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'PASSWORD1!' })
      submitSignInForm()

      expect(
        await screen.findByText('Password must include a lowercase letter'),
      ).toBeDefined()
    })

    it('rejects passwords without a number', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'Password!!' })
      submitSignInForm()

      expect(
        await screen.findByText('Password must include a number'),
      ).toBeDefined()
    })

    it('rejects passwords without a special character', async () => {
      renderSignInForm()
      fillSignInForm({ email: validEmail, password: 'Password12' })
      submitSignInForm()

      expect(
        await screen.findByText('Password must include a special character'),
      ).toBeDefined()
    })

    it('accepts the seeded mock password', async () => {
      renderSignInForm()
      fillSignInForm()
      submitSignInForm()

      await waitFor(() => {
        expect(screen.getByText(successMessage)).toBeDefined()
      })
    })
  })

  describe('UX behavior', () => {
    it('shows errors under the correct fields', async () => {
      renderSignInForm()
      submitSignInForm()

      const emailError = await screen.findByText(
        'Institutional email is required',
      )
      const passwordError = await screen.findByText('Security key is required')

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
      renderSignInForm({ onSubmitDelay: 100 })
      fillSignInForm()
      submitSignInForm()

      await waitFor(() => {
        expect(getSubmitButton()).toHaveProperty('disabled', true)
      })
    })

    it('submits when Enter is pressed', async () => {
      renderSignInForm()
      fillSignInForm()

      fireEvent.submit(getForm())

      await waitFor(() => {
        expect(screen.getByText(successMessage)).toBeDefined()
      })
    })

    it('shows a success message on valid seeded credentials', async () => {
      renderSignInForm()
      fillSignInForm({
        email: 'INSTRUCTOR@MORSHID.DEMO',
        password: validPassword,
      })
      submitSignInForm()

      await waitFor(() => {
        expect(screen.getByText(successMessage)).toBeDefined()
      })
      expect(useAuthStore.getState()).toMatchObject({
        user: {
          email: validEmail,
          role: 'instructor',
        },
        accessToken: 'mock-access-token:mock-instructor',
        refreshToken: 'mock-refresh-token:mock-instructor',
        isAuthenticated: true,
      })
    })

    it('shows a generic error for wrong mock credentials', async () => {
      renderSignInForm()
      fillSignInForm({ password: 'Password1!' })
      submitSignInForm()

      expect(await screen.findByText(INVALID_CREDENTIALS_MESSAGE)).toBeDefined()
      expect(screen.queryByText(successMessage)).toBeNull()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })

    it('shows the disabled account message for disabled mock credentials', async () => {
      renderSignInForm()
      fillSignInForm({
        email: 'disabled@morshid.demo',
        password: validPassword,
      })
      submitSignInForm()

      expect(await screen.findByText(DISABLED_ACCOUNT_MESSAGE)).toBeDefined()
      expect(screen.queryByText(successMessage)).toBeNull()
    })

    it('does not submit when the form is invalid', async () => {
      renderSignInForm()
      fillSignInForm({ email: 'invalid-email', password: 'short' })
      submitSignInForm()

      await screen.findByText('Enter a valid email address')

      expect(screen.queryByText(successMessage)).toBeNull()
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
