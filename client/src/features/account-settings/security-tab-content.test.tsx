import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import * as passwordApi from '@/features/auth/session/interface/account-password'
import { ApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { SecurityTabContent } from './security-tab-content'

vi.mock('@/features/auth/session/interface/account-password')

describe('SecurityTabContent', () => {
  const studentSession: AuthSession = {
    tokenType: 'Bearer',
    user: {
      id: 'student-1',
      email: 'student@morshid.demo',
      displayName: 'Amina Al-Mansoor',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    accessToken: 'student-token',
    accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().clearSession()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  it('renders password change form with proper fields and password-manager attributes', () => {
    useAuthStore.getState().setSession(studentSession)

    render(<SecurityTabContent />)

    expect(
      screen.getByRole('heading', { name: 'Change Password' }),
    ).toBeInTheDocument()
    const currentInput = screen.getByLabelText('Current password')
    const newInput = screen.getByLabelText('New password')
    const confirmInput = screen.getByLabelText('Confirm new password')

    expect(currentInput).toHaveAttribute('type', 'password')
    expect(currentInput).toHaveAttribute('autoComplete', 'current-password')
    expect(newInput).toHaveAttribute('type', 'password')
    expect(newInput).toHaveAttribute('autoComplete', 'new-password')
    expect(confirmInput).toHaveAttribute('type', 'password')
    expect(confirmInput).toHaveAttribute('autoComplete', 'new-password')
  })

  it('toggles password visibility for fields', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<SecurityTabContent />)

    const currentInput = screen.getByLabelText('Current password')
    const showCurrentBtn = screen.getByRole('button', {
      name: 'Show current password',
    })

    expect(currentInput).toHaveAttribute('type', 'password')
    await user.click(showCurrentBtn)
    expect(currentInput).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('button', { name: 'Hide current password' }),
    ).toBeInTheDocument()

    const newInput = screen.getByLabelText('New password')
    const showNewBtn = screen.getByRole('button', { name: 'Show new password' })
    expect(newInput).toHaveAttribute('type', 'password')
    await user.click(showNewBtn)
    expect(newInput).toHaveAttribute('type', 'text')
  })

  it('allows pasting into password inputs', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<SecurityTabContent />)

    const currentInput = screen.getByLabelText('Current password')
    await user.click(currentInput)
    await user.paste('pasted-current-password')
    expect(currentInput).toHaveValue('pasted-current-password')

    const newInput = screen.getByLabelText('New password')
    await user.click(newInput)
    await user.paste('pasted-new-valid-passphrase-2026')
    expect(newInput).toHaveValue('pasted-new-valid-passphrase-2026')
  })

  it('shows validation error when new password is shorter than 15 characters', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<SecurityTabContent />)

    await user.type(
      screen.getByLabelText('Current password'),
      'old-password-12345',
    )
    await user.type(screen.getByLabelText('New password'), 'ShortPass123!')
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ShortPass123!',
    )

    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(
      await screen.findByText('New password must be at least 15 characters.'),
    ).toBeInTheDocument()
    expect(passwordApi.changePasswordApi).not.toHaveBeenCalled()
  })

  it('shows validation error when confirmation does not match new password', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<SecurityTabContent />)

    await user.type(
      screen.getByLabelText('Current password'),
      'old-password-12345',
    )
    await user.type(
      screen.getByLabelText('New password'),
      'a valid fifteen character password',
    )
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'a different fifteen character password',
    )

    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(
      await screen.findByText('New password and confirmation do not match.'),
    ).toBeInTheDocument()
    expect(passwordApi.changePasswordApi).not.toHaveBeenCalled()
  })

  it('submits valid password change, updates auth store with rotated session, and displays success message', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    const rotatedSession: AuthSession = {
      tokenType: 'Bearer',
      user: studentSession.user,
      accessToken: 'rotated-student-token',
      accessTokenExpiresAt: '2026-07-11T13:15:00.000Z',
    }

    vi.mocked(passwordApi.changePasswordApi).mockResolvedValueOnce(
      rotatedSession,
    )

    render(<SecurityTabContent />)

    await user.type(
      screen.getByLabelText('Current password'),
      'old-password-12345',
    )
    await user.type(
      screen.getByLabelText('New password'),
      'a brand new secure passphrase 2026',
    )
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'a brand new secure passphrase 2026',
    )

    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(passwordApi.changePasswordApi).toHaveBeenCalledWith({
      currentPassword: 'old-password-12345',
      newPassword: 'a brand new secure passphrase 2026',
      confirmation: 'a brand new secure passphrase 2026',
    })

    expect(
      await screen.findByText(
        'Password changed successfully. Your session has been updated.',
      ),
    ).toBeInTheDocument()

    // Auth store session should be updated
    expect(useAuthStore.getState().accessToken).toBe('rotated-student-token')

    // Inputs should be cleared
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
  })

  it('displays API error message on failure', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    vi.mocked(passwordApi.changePasswordApi).mockRejectedValueOnce(
      new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS'),
    )

    render(<SecurityTabContent />)

    await user.type(
      screen.getByLabelText('Current password'),
      'wrong-current-password',
    )
    await user.type(
      screen.getByLabelText('New password'),
      'a brand new secure passphrase 2026',
    )
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'a brand new secure passphrase 2026',
    )

    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(
      await screen.findByText('Invalid email or password'),
    ).toBeInTheDocument()
  })
})
