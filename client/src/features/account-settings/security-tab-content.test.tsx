import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as activeSessionsApi from './active-sessions/active-sessions.api'
import { SecurityTabContent } from './security-tab-content'
import type { ActiveSession } from './active-sessions/active-sessions.types'

vi.mock('./active-sessions/active-sessions.api')

describe('SecurityTabContent', () => {
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
  })

  afterEach(() => {
    cleanup()
  })

  it('renders loading state initially and then lists active sessions', async () => {
    vi.mocked(activeSessionsApi.fetchActiveSessions).mockResolvedValue(
      mockSessions,
    )

    render(<SecurityTabContent />)

    expect(screen.getByTestId('sessions-loading')).toBeInTheDocument()

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

    // Current session has no revoke button
    const currentItem = screen.getByTestId(
      'session-item-00000000-0000-4000-8000-000000000001',
    )
    expect(
      currentItem.querySelector('button[name="Revoke"]'),
    ).not.toBeInTheDocument()

    // Remote session has Revoke button
    const revokeButton = screen.getByRole('button', { name: /revoke/i })
    await user.click(revokeButton)

    // Confirmation dialog appears
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
      expect(activeSessionsApi.revokeOtherActiveSessions).toHaveBeenCalledTimes(
        1,
      )
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
      expect(screen.getByText(/no active sessions found/i)).toBeInTheDocument()
    })
  })
})
