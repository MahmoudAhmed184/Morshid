import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import * as profileApi from '@/features/auth/session/interface/account-profile'
import { ApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { AccountTabContent } from './account-tab-content'

vi.mock('@/features/auth/session/interface/account-profile')

describe('AccountTabContent', () => {
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

  it('renders user details, status, and role badge when authenticated', () => {
    useAuthStore.getState().setSession(studentSession)

    render(<AccountTabContent />)

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('Amina Al-Mansoor')).toBeInTheDocument()
    expect(screen.getAllByText('student@morshid.demo')).toHaveLength(2) // in profile header and email field
    expect(screen.getAllByText('Student')).toHaveLength(2) // in badge and role field
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByLabelText('Display name')).toHaveValue(
      'Amina Al-Mansoor',
    )
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  it('renders administrator role badge for admin accounts', () => {
    const adminSession: AuthSession = {
      tokenType: 'Bearer',
      user: {
        id: 'admin-1',
        email: 'admin@morshid.demo',
        displayName: 'System Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      accessToken: 'admin-token',
      accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
    }
    useAuthStore.getState().setSession(adminSession)

    render(<AccountTabContent />)

    expect(screen.getAllByText('Administrator')).toHaveLength(2)
  })

  it('allows all three roles (Student, Instructor, Admin) to update display name successfully', async () => {
    const user = userEvent.setup()

    for (const role of ['STUDENT', 'INSTRUCTOR', 'ADMIN'] as const) {
      const session: AuthSession = {
        tokenType: 'Bearer',
        user: {
          id: `${role.toLowerCase()}-1`,
          email: `${role.toLowerCase()}@morshid.demo`,
          displayName: `Original ${role}`,
          role,
          status: 'ACTIVE',
        },
        accessToken: `${role.toLowerCase()}-token`,
        accessTokenExpiresAt: '2026-07-11T12:15:00.000Z',
      }
      useAuthStore.getState().setSession(session)

      const updatedName = `New ${role} Name`
      vi.mocked(profileApi.updateOwnProfile).mockResolvedValueOnce({
        ...session.user,
        displayName: updatedName,
      })

      const { unmount } = render(<AccountTabContent />)

      const input = screen.getByLabelText('Display name')
      await user.clear(input)
      await user.type(input, `  ${updatedName}  `)

      const saveButton = screen.getByRole('button', { name: 'Save changes' })
      await user.click(saveButton)

      expect(profileApi.updateOwnProfile).toHaveBeenCalledWith({
        displayName: updatedName,
      })

      expect(
        await screen.findByText('Profile updated successfully.'),
      ).toBeInTheDocument()

      expect(useAuthStore.getState().user?.displayName).toBe(updatedName)
      expect(screen.getByText(updatedName)).toBeInTheDocument()

      unmount()
    }
  })

  it('trims leading and trailing whitespace consistently on submission', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    vi.mocked(profileApi.updateOwnProfile).mockResolvedValueOnce({
      ...studentSession.user,
      displayName: 'Trimmed Name',
    })

    render(<AccountTabContent />)

    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, '   Trimmed Name   ')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(profileApi.updateOwnProfile).toHaveBeenCalledWith({
      displayName: 'Trimmed Name',
    })
  })

  it('rejects display names shorter than 2 characters after trimming and preserves entered value', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<AccountTabContent />)

    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, '  A  ')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(profileApi.updateOwnProfile).not.toHaveBeenCalled()
    expect(
      screen.getByText('Display name must be at least 2 characters.'),
    ).toBeInTheDocument()
    expect(input).toHaveValue('  A  ')
  })

  it('rejects display names longer than 120 characters and preserves entered value', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    render(<AccountTabContent />)

    const input = screen.getByLabelText('Display name')
    // Temporarily increase maxLength so we can type 121 chars to test validation
    input.removeAttribute('maxlength')
    const longName = 'A'.repeat(121)
    await user.clear(input)
    await user.type(input, longName)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(profileApi.updateOwnProfile).not.toHaveBeenCalled()
    expect(
      screen.getByText('Display name must not exceed 120 characters.'),
    ).toBeInTheDocument()
    expect(input).toHaveValue(longName)
  })

  it('displays server error message on failure and preserves entered value for correction', async () => {
    const user = userEvent.setup()
    useAuthStore.getState().setSession(studentSession)

    vi.mocked(profileApi.updateOwnProfile).mockRejectedValueOnce(
      new ApiError('Account is disabled', 403, 'ACCOUNT_DISABLED'),
    )

    render(<AccountTabContent />)

    const input = screen.getByLabelText('Display name')
    await user.clear(input)
    await user.type(input, 'Failed Name Attempt')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(profileApi.updateOwnProfile).toHaveBeenCalledWith({
      displayName: 'Failed Name Attempt',
    })
    expect(await screen.findByText('Account is disabled')).toBeInTheDocument()
    expect(input).toHaveValue('Failed Name Attempt')
  })
})
