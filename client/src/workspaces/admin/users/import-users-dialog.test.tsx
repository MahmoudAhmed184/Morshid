import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EditImportRowDialog,
  RemoveImportRowDialog,
} from './import-users-dialog'
import type { UserImport } from '@/features/user-management/managed-user.schema'
import { ApiError } from '@/features/auth/session/interface/authenticated-api-client'

const row: UserImport['rows'][number] = {
  id: '00000000-0000-4000-8000-000000000002',
  rowNumber: 2,
  displayName: 'Original Student',
  email: 'original@example.com',
  role: 'STUDENT',
  status: 'INVALID',
  errors: ['Email: A user with this email already exists'],
  hasPassword: true,
}

describe(EditImportRowDialog.name, () => {
  afterEach(cleanup)

  it('loads editable values, shows field errors, and never renders a password', async () => {
    const user = userEvent.setup()
    render(<EditImportRowDialog row={row} pending={false} onSave={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Original Student',
    )
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'original@example.com',
    )
    expect(
      screen.getByText('Email: A user with this email already exists'),
    ).toBeVisible()
    expect(screen.getByLabelText('Replace password (optional)')).toHaveValue('')
    expect(
      screen.getByText('Leave blank to keep the current password.'),
    ).toBeVisible()
    expect(screen.queryByDisplayValue(/hash|password/i)).not.toBeInTheDocument()
  })

  it('omits an empty password so the staged password is preserved', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditImportRowDialog row={row} pending={false} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        displayName: 'Original Student',
        email: 'original@example.com',
      }),
    )
  })

  it('submits name, email, and an optional replacement password', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditImportRowDialog row={row} pending={false} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const name = screen.getByRole('textbox', { name: 'Name' })
    const email = screen.getByRole('textbox', { name: 'Email' })
    const password = screen.getByLabelText('Replace password (optional)')
    await user.clear(name)
    await user.type(name, 'Edited Student')
    await user.clear(email)
    await user.type(email, 'edited@example.com')
    await user.type(password, 'a replacement passphrase')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        displayName: 'Edited Student',
        email: 'edited@example.com',
        password: 'a replacement passphrase',
      }),
    )
  })

  it('shows a password validation issue under the field without the generic error', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(
      new ApiError('Invalid user create request', 400, 'INVALID_REQUEST', [
        {
          field: 'password',
          message: 'Password must be at least 15 characters',
        },
      ]),
    )
    render(<EditImportRowDialog row={row} pending={false} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(
      screen.getByLabelText('Replace password (optional)'),
      'short',
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Password must be at least 15 characters'),
    ).toBeVisible()
    expect(
      screen.queryByText('Invalid user create request'),
    ).not.toBeInTheDocument()
  })
})

describe(RemoveImportRowDialog.name, () => {
  afterEach(cleanup)

  it('confirms removal with the required warning', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(<RemoveImportRowDialog pending={false} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(
      screen.getByRole('heading', {
        name: 'Remove this user from the import?',
      }),
    ).toBeVisible()
    expect(screen.getByText('This row will not be imported.')).toBeVisible()
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Remove',
      }),
    )

    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1))
  })

  it('keeps the confirmation open and shows mutation errors', async () => {
    const user = userEvent.setup()
    render(
      <RemoveImportRowDialog
        pending={false}
        onRemove={vi.fn().mockRejectedValue(new Error('Unable to remove row'))}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Remove',
      }),
    )

    expect(await screen.findByText('Unable to remove row')).toBeVisible()
    expect(
      screen.getByRole('heading', {
        name: 'Remove this user from the import?',
      }),
    ).toBeVisible()
  })
})
