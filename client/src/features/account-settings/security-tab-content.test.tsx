import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import * as passwordApi from '@/features/auth/session/interface/account-password'
import { ApiError } from '@/features/auth/session/interface/authenticated-api-client'
import * as activeSessionsApi from './active-sessions/active-sessions.api'
import { SecurityTabContent } from './security-tab-content'
import type { ActiveSession } from './active-sessions/active-sessions.types'

vi.mock('@/features/auth/session/interface/account-password')
vi.mock('./active-sessions/active-sessions.api')

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

  const mockSessions: ActiveSession[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      device: 'Chrome on macOS',
      ip: '192.168.1.***',
      createdAt: '2026-08-15T12:00:00.000Z',
      lastActiveAt: '2026-08-15T12:30:00.000Z',
      expiresAt: '2026-08-22T12:00:00.000Z',
      isCurrent: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      device: 'Firefox on Windows',
      ip: '10.0.0.***',
      createdAt: '2026-08-14T08:00:00.000Z',
      lastActiveAt: '2026-08-14T09:00:00.000Z',
      expiresAt: '2026-08-21T08:00:00.000Z',
      isCurrent: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().clearSession()
    vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue(
      mockSessions,
    )
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
  })

  describe('Password Change', () => {
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
      const showNewBtn = screen.getByRole('button', {
        name: 'Show new password',
      })
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

    it('shows validation error when new password is shorter than 9 characters', async () => {
      const user = userEvent.setup()
      useAuthStore.getState().setSession(studentSession)

      render(<SecurityTabContent />)

      await user.type(
        screen.getByLabelText('Current password'),
        'old-password-12345',
      )
      await user.type(screen.getByLabelText('New password'), 'Short1!')
      await user.type(
        screen.getByLabelText('Confirm new password'),
        'Short1!',
      )

      await user.click(screen.getByRole('button', { name: 'Change password' }))

      expect(
        await screen.findByText('New password must be at least 9 characters.'),
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

      expect(useAuthStore.getState().accessToken).toBe('rotated-student-token')
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

  describe('Active Sessions', () => {
    it('renders loading state initially and then lists active sessions', async () => {
      vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue(
        mockSessions,
      )

      render(<SecurityTabContent />)

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: 'Active Sessions' }),
        ).toBeInTheDocument()
      })

      expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
      expect(screen.getByText('Current session')).toBeInTheDocument()
      expect(screen.getByText('192.168.1.***')).toBeInTheDocument()

      expect(screen.getByText('Firefox on Windows')).toBeInTheDocument()
      expect(screen.getByText('10.0.0.***')).toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: /sign out all other sessions/i }),
      ).toBeInTheDocument()
    })

    it('allows revoking a single remote session with confirmation dialog', async () => {
      const user = userEvent.setup()
      vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue(
        mockSessions,
      )
      vi.mocked(activeSessionsApi.revokeActiveSession).mockResolvedValue(
        undefined,
      )

      render(<SecurityTabContent />)

      await waitFor(() => {
        expect(screen.getByText('Firefox on Windows')).toBeInTheDocument()
      })

      const revokeButton = screen.getByRole('button', { name: /revoke/i })
      await user.click(revokeButton)

      expect(
        screen.getByRole('heading', { name: /revoke active session\?/i }),
      ).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', {
        name: /revoke session/i,
      })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(activeSessionsApi.revokeActiveSession).toHaveBeenCalledWith(
          '00000000-0000-4000-8000-000000000002',
        )
      })

      expect(
        screen.getAllByText(/session revoked successfully/i).length,
      ).toBeGreaterThan(0)
      expect(screen.queryByText('Firefox on Windows')).not.toBeInTheDocument()
    })

    it('allows signing out all other sessions with confirmation dialog', async () => {
      const user = userEvent.setup()
      vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue(
        mockSessions,
      )
      vi.mocked(activeSessionsApi.revokeOtherActiveSessions).mockResolvedValue(
        undefined,
      )

      render(<SecurityTabContent />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /sign out all other sessions/i }),
        ).toBeInTheDocument()
      })

      await user.click(
        screen.getByRole('button', { name: /sign out all other sessions/i }),
      )

      expect(
        screen.getByRole('heading', {
          name: /sign out all other sessions\?/i,
        }),
      ).toBeInTheDocument()

      const confirmButton = screen.getByRole('button', {
        name: /sign out other sessions/i,
      })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(
          activeSessionsApi.revokeOtherActiveSessions,
        ).toHaveBeenCalledTimes(1)
      })

      expect(
        screen.getAllByText(/all other active sessions have been signed out/i)
          .length,
      ).toBeGreaterThan(0)
      expect(screen.queryByText('Firefox on Windows')).not.toBeInTheDocument()
      expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
    })

    it('renders error state when fetch fails and allows retrying', async () => {
      const user = userEvent.setup()
      vi.mocked(activeSessionsApi.fetchActiveSessions)
        .mockRejectedValueOnce(new Error('Network error loading sessions'))
        .mockResolvedValueOnce(mockSessions)

      render(<SecurityTabContent />)

      await waitFor(() => {
        expect(
          screen.getByText('Network error loading sessions'),
        ).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
      })
    })

    it('renders empty state when no sessions are returned', async () => {
      vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue([])

      render(<SecurityTabContent />)

      await waitFor(() => {
        expect(
          screen.getByText(/no active sessions found/i),
        ).toBeInTheDocument()
      })
    })
  })
})
